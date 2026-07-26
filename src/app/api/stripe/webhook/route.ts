import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { postPaymentEntries, postRefundEntries } from "@/lib/ledger";
import { sendPaymentConfirmation, sendClubEnrollmentConfirmation, sendShopOrderConfirmation, sendDinnerTopUpConfirmation } from "@/lib/email";

// Raw body required for Stripe signature verification
export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  // 1. Read raw body and signature header
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
  }

  // 2. Verify signature — rejects unsigned, tampered, or stale (>5 min) requests
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const db = serviceClient();

  // 3. Idempotency — check if we've already processed this event id
  const { data: existing } = await db
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    console.log(`[webhook] duplicate event ignored: ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // 4. Insert stripe_events row first (unique constraint prevents concurrent double-processing)
  const { error: insertErr } = await db.from("stripe_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (insertErr) {
    // Unique violation means a concurrent request beat us — treat as duplicate
    if (insertErr.code === "23505") {
      console.log(`[webhook] race-condition duplicate: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[webhook] failed to insert stripe_event:", insertErr);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  // 5. Dispatch to event-specific handlers
  // Tag Sentry scope with event metadata so failures are easy to diagnose
  Sentry.setTag("stripe.event_type", event.type);
  Sentry.setTag("stripe.event_id", event.id);
  if (event.account) Sentry.setTag("stripe.account", event.account);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(db, session);
        await handleClubEnrollmentPaid(db, session);
        await handleShopOrderPaid(db, session);
        break;
      }

      case "payment_intent.succeeded":
        await handlePaymentSucceeded(db, event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(db, event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(db, event.data.object as Stripe.Charge);
        break;

      case "payout.paid":
        await handlePayoutPaid(db, event.data.object as Stripe.Payout, event.account);
        break;

      default:
        // Unknown event types: log and return 200 — never 500, or Stripe retries forever
        console.log(`[webhook] unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Capture to Sentry with full event context before returning 500 so Stripe retries
    Sentry.captureException(err, {
      tags: { "stripe.event_type": event.type, "stripe.event_id": event.id },
      extra: { eventType: event.type, eventId: event.id, account: event.account },
    });
    console.error(`[webhook] handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  console.log(`[webhook] processed: ${event.type} ${event.id}`);
  return NextResponse.json({ received: true });
}

// ── checkout.session.completed (dinner top-up) ───────────────────────────────
async function handleCheckoutCompleted(
  db: ReturnType<typeof serviceClient>,
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {};
  if (meta.type !== "dinner_topup") return; // not a dinner top-up — ignore

  const { guardian_id, school_id, wallet_id } = meta;
  if (!guardian_id || !school_id || !wallet_id) {
    console.warn("[webhook] dinner_topup missing metadata fields");
    return;
  }

  // Amount is in smallest currency unit (pence)
  const amountPence = session.amount_total;
  if (!amountPence || amountPence <= 0) return;

  // Get current wallet balance
  const { data: wallet } = await (db.from("dinner_wallets") as any)
    .select("id, balance_pence")
    .eq("id", wallet_id)
    .single() as { data: { id: string; balance_pence: number } | null };

  if (!wallet) {
    console.warn(`[webhook] dinner_topup: wallet ${wallet_id} not found`);
    return;
  }

  const balanceAfter = wallet.balance_pence + amountPence;

  // Append transaction (append-only — never update)
  await (db.from("dinner_transactions") as any).insert({
    wallet_id: wallet.id,
    type: "topup",
    amount_pence: amountPence,
    balance_after_pence: balanceAfter,
    stripe_payment_intent: typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id: string } | null)?.id ?? null,
    note: "Online top-up via card",
    date: new Date().toISOString().slice(0, 10),
  });

  // Update wallet balance
  await (db.from("dinner_wallets") as any)
    .update({ balance_pence: balanceAfter, updated_at: new Date().toISOString() })
    .eq("id", wallet.id);

  // Send top-up confirmation email
  const { data: guardian } = await db.from("guardians").select("email").eq("id", guardian_id).single();
  const { data: school } = await db.from("schools").select("name").eq("id", school_id).single();

  // Get student name from wallet
  const { data: walletRow } = await (db.from("dinner_wallets") as any)
    .select("student_id")
    .eq("id", wallet_id)
    .single() as { data: { student_id: string } | null };

  const { data: student } = walletRow
    ? await db.from("students").select("first_name").eq("id", walletRow.student_id).single()
    : { data: null };

  if (guardian?.email) {
    await sendDinnerTopUpConfirmation({
      email: guardian.email,
      schoolName: school?.name ?? "",
      studentName: student?.first_name ?? "your child",
      amountPence,
      balanceAfterPence: balanceAfter,
    }).catch((err) => console.error("[webhook] dinner topup email failed:", err));
  }

  console.log(`[webhook] dinner_topup: wallet ${wallet_id} credited ${amountPence}p → balance ${balanceAfter}p`);
}

async function handleClubEnrollmentPaid(
  db: ReturnType<typeof serviceClient>,
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {};
  if (meta.type !== "club_enrollment") return;

  const { enrollment_id } = meta;
  if (!enrollment_id) return;

  await (db.from("club_enrollments") as any)
    .update({ payment_status: "paid", updated_at: new Date().toISOString() })
    .eq("id", enrollment_id);

  // Send confirmation email to parent
  const { data: enrollment } = await (db.from("club_enrollments") as any)
    .select("guardian_id, student_id, club_id")
    .eq("id", enrollment_id)
    .single() as { data: { guardian_id: string; student_id: string; club_id: string } | null };

  if (enrollment) {
    const [{ data: guardian }, { data: student }, { data: club }] = await Promise.all([
      db.from("guardians").select("email").eq("id", enrollment.guardian_id).single() as Promise<{ data: { email: string } | null }>,
      db.from("students").select("first_name").eq("id", enrollment.student_id).single() as Promise<{ data: { first_name: string } | null }>,
      (db.from("clubs") as any).select("name, fee_pence, fee_model, sessions_per_term, day_of_week, start_date, schools(name)").eq("id", enrollment.club_id).single() as Promise<{ data: { name: string; fee_pence: number; fee_model: string; sessions_per_term: number | null; day_of_week: string | null; start_date: string | null; schools: { name: string } | null } | null }>,
    ]);

    if (guardian?.email && student && club) {
      const totalFee = club.fee_model === "weekly"
        ? club.fee_pence * (club.sessions_per_term ?? 1)
        : club.fee_pence;

      await sendClubEnrollmentConfirmation({
        email: guardian.email,
        clubName: club.name,
        schoolName: (club.schools as any)?.name ?? "",
        childName: student.first_name,
        amountPence: totalFee,
        dayOfWeek: club.day_of_week,
        startDate: club.start_date,
      }).catch((err) => console.error("[webhook] club confirmation email failed:", err));
    }
  }

  console.log(`[webhook] club enrollment ${enrollment_id} marked paid`);
}

async function handleShopOrderPaid(
  db: ReturnType<typeof serviceClient>,
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {};
  if (meta.type !== "shop_order") return;

  const { order_id, school_id } = meta;
  if (!order_id) return;

  await (db.from("shop_orders") as any)
    .update({ status: "paid", stripe_payment_intent: session.payment_intent as string ?? null, updated_at: new Date().toISOString() })
    .eq("id", order_id);

  // Decrement stock for each line
  const { data: lines } = await (db.from("shop_order_lines") as any)
    .select("item_id, quantity")
    .eq("order_id", order_id) as { data: Array<{ item_id: string; quantity: number }> | null };

  for (const line of lines ?? []) {
    const { data: item } = await (db.from("shop_items") as any)
      .select("stock")
      .eq("id", line.item_id)
      .single() as { data: { stock: number | null } | null };

    if (item?.stock !== null && item?.stock !== undefined) {
      await (db.from("shop_items") as any)
        .update({ stock: Math.max(0, item.stock - line.quantity), updated_at: new Date().toISOString() })
        .eq("id", line.item_id);
    }
  }

  // Send order confirmation email
  const { data: order } = await (db.from("shop_orders") as any)
    .select("guardian_id")
    .eq("id", order_id)
    .single() as { data: { guardian_id: string } | null };

  if (order?.guardian_id) {
    const { data: guardian } = await db.from("guardians").select("email").eq("id", order.guardian_id).single();
    const { data: school } = await db.from("schools").select("name").eq("id", school_id).single();

    const itemDetails = await Promise.all(
      (lines ?? []).map(async (line) => {
        const { data: item } = await (db.from("shop_items") as any)
          .select("name, price_pence")
          .eq("id", line.item_id)
          .single() as { data: { name: string; price_pence: number } | null };
        return item ? { name: item.name, quantity: line.quantity, unitPricePence: item.price_pence } : null;
      })
    );

    const validItems = itemDetails.filter(Boolean) as Array<{ name: string; quantity: number; unitPricePence: number }>;

    if (guardian?.email && validItems.length > 0) {
      await sendShopOrderConfirmation({
        email: guardian.email,
        schoolName: school?.name ?? "",
        items: validItems,
      }).catch((err) => console.error("[webhook] shop order email failed:", err));
    }
  }

  console.log(`[webhook] shop order ${order_id} marked paid`);
}

// ── payment_intent.succeeded ─────────────────────────────────────────────────
async function handlePaymentSucceeded(
  db: ReturnType<typeof serviceClient>,
  pi: Stripe.PaymentIntent
): Promise<void> {
  // Find transaction by PI id; fall back to PI metadata.transaction_id for older rows
  let { data: txn } = await db
    .from("transactions")
    .select("id, amount_pence, status")
    .eq("stripe_payment_intent", pi.id)
    .maybeSingle();

  if (!txn) {
    const txnIdFromMeta = pi.metadata?.transaction_id;
    if (!txnIdFromMeta) {
      console.warn(`[webhook] no transaction found for PI: ${pi.id}`);
      return;
    }
    const { data: txnByMeta } = await db
      .from("transactions")
      .select("id, amount_pence, status")
      .eq("id", txnIdFromMeta)
      .maybeSingle();
    txn = txnByMeta;
  }

  if (!txn) {
    console.warn(`[webhook] no transaction found for PI: ${pi.id} (metadata fallback also failed)`);
    return;
  }

  // Backfill stripe_payment_intent for fast future lookups
  await db
    .from("transactions")
    .update({ stripe_payment_intent: pi.id })
    .eq("id", txn.id)
    .is("stripe_payment_intent", null);

  // Already succeeded (shouldn't happen after idempotency check, but guard anyway)
  if (txn.status === "succeeded") return;

  // Mark transaction succeeded
  await db
    .from("transactions")
    .update({ status: "succeeded", updated_at: new Date().toISOString() })
    .eq("id", txn.id);

  // Fetch all transaction_lines for this transaction
  const { data: lines } = await db
    .from("transaction_lines")
    .select("id, assignment_id, amount_pence")
    .eq("transaction_id", txn.id);

  if (!lines?.length) return;

  // For each line: increment assignment amount_paid_pence and update status
  for (const line of lines) {
    const { data: assignment } = await db
      .from("assignments")
      .select("id, amount_due_pence, amount_paid_pence")
      .eq("id", line.assignment_id)
      .single();

    if (!assignment) continue;

    const newPaid = assignment.amount_paid_pence + line.amount_pence;
    const newStatus =
      newPaid >= assignment.amount_due_pence
        ? "paid"
        : newPaid > 0
        ? "partial"
        : "unpaid";

    await db
      .from("assignments")
      .update({
        amount_paid_pence: newPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);
  }

  // Post double-entry ledger rows for the whole transaction gross amount
  await postPaymentEntries(db, txn.id, txn.amount_pence);

  // Send confirmation email using only flat queries — no nested joins
  const { data: txnRow } = await db
    .from("transactions")
    .select("guardian_id")
    .eq("id", txn.id)
    .single();

  if (!txnRow?.guardian_id) return;

  const { data: guardian } = await db
    .from("guardians")
    .select("email")
    .eq("id", txnRow.guardian_id)
    .single();

  if (!guardian?.email) return;

  // Build children list from the lines array already fetched above
  const children: Array<{ firstName: string; yearGroup: string; amountPence: number }> = [];
  let requestTitle = "";
  let schoolName = "";

  for (const line of lines) {
    const { data: asgn } = await db
      .from("assignments")
      .select("payment_request_id, student_id")
      .eq("id", line.assignment_id)
      .single();

    if (!asgn) continue;

    const { data: student } = await db
      .from("students")
      .select("first_name, year_group")
      .eq("id", asgn.student_id)
      .single();

    if (student) {
      children.push({ firstName: student.first_name, yearGroup: student.year_group, amountPence: line.amount_pence });
    }

    if (!requestTitle && asgn.payment_request_id) {
      const { data: pr } = await db
        .from("payment_requests")
        .select("title, school_id")
        .eq("id", asgn.payment_request_id)
        .single();

      requestTitle = pr?.title ?? "";

      if (pr?.school_id) {
        const { data: school } = await db
          .from("schools")
          .select("name")
          .eq("id", pr.school_id)
          .single();
        schoolName = school?.name ?? "";
      }
    }
  }

  if (children.length > 0 && requestTitle) {
    await sendPaymentConfirmation({ email: guardian.email, requestTitle, schoolName, children })
      .catch((err) => console.error("[webhook] confirmation email failed:", err));
  } else {
    console.warn(`[webhook] skipped confirmation: children=${children.length} title="${requestTitle}"`);
  }
}

// ── payment_intent.payment_failed ────────────────────────────────────────────
async function handlePaymentFailed(
  db: ReturnType<typeof serviceClient>,
  pi: Stripe.PaymentIntent
): Promise<void> {
  // Mark transaction failed; assignments are completely untouched
  await db
    .from("transactions")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent", pi.id);
}

// ── payout.paid ──────────────────────────────────────────────────────────────
async function handlePayoutPaid(
  db: ReturnType<typeof serviceClient>,
  payout: Stripe.Payout,
  stripeAccountId: string | undefined
): Promise<void> {
  if (!stripeAccountId) {
    console.warn("[webhook] payout.paid missing account id");
    return;
  }

  // Resolve school_id from the connected account's stripe_account_id
  const { data: trust } = await db
    .from("trusts")
    .select("id, schools(id)")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle() as {
      data: { id: string; schools: Array<{ id: string }> | { id: string } | null } | null
    };

  const schoolId = trust
    ? (Array.isArray(trust.schools) ? trust.schools[0]?.id : (trust.schools as { id: string } | null)?.id)
    : null;

  if (!schoolId) {
    console.warn(`[webhook] payout.paid: no school found for Stripe account ${stripeAccountId}`);
    return;
  }

  // Fetch all balance transactions for this payout from Stripe (paginate fully)
  const balanceTxns: Stripe.BalanceTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const page = await stripe.balanceTransactions.list(
      { payout: payout.id, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      { stripeAccount: stripeAccountId }
    );
    balanceTxns.push(...page.data);
    hasMore = page.has_more;
    if (page.data.length) startingAfter = page.data[page.data.length - 1].id;
  }

  // Sum payout-level totals
  let grossPence = 0;
  let stripeFeePence = 0;
  let appFeePence = 0;

  // For each balance transaction, try to match to our transactions table
  type PayoutLineInsert = {
    payout_id: string;
    transaction_id: string | null;
    stripe_balance_txn_id: string;
    stripe_charge_id: string | null;
    stripe_payment_intent_id: string | null;
    type: string;
    gross_pence: number;
    stripe_fee_pence: number;
    app_fee_pence: number;
    net_pence: number;
    description: string | null;
    matched: boolean;
  };

  const lineInserts: PayoutLineInsert[] = [];
  let unmatchedCount = 0;

  for (const bt of balanceTxns) {
    const btGross = bt.amount; // signed pence
    const btFee = bt.fee;      // Stripe fee in pence (always positive)
    const btNet = bt.net;      // net pence

    grossPence += btGross;
    stripeFeePence += btFee;

    // Try to match via payment_intent id (stored on charge source)
    let ourTxnId: string | null = null;
    let ourAppFee = 0;
    let piId: string | null = null;
    let chargeId: string | null = null;

    const source = bt.source;
    if (source && typeof source === "object") {
      const src = source as { id?: string; payment_intent?: string | { id: string }; object?: string };
      chargeId = src.id ?? null;
      if (src.payment_intent) {
        piId = typeof src.payment_intent === "string" ? src.payment_intent : src.payment_intent.id;
      }
    }

    if (piId) {
      const { data: txn } = await db
        .from("transactions")
        .select("id")
        .eq("stripe_payment_intent", piId)
        .maybeSingle();
      ourTxnId = txn?.id ?? null;
    }

    const matched = ourTxnId !== null;
    if (!matched && bt.type !== "payout") unmatchedCount++;

    // App fee: 50p per charge we can match; 0 for refunds/adjustments/unmatched
    if (matched && bt.type === "charge") {
      ourAppFee = 50;
      appFeePence += ourAppFee;
    }

    lineInserts.push({
      payout_id: "", // filled after payout insert
      transaction_id: ourTxnId,
      stripe_balance_txn_id: bt.id,
      stripe_charge_id: chargeId,
      stripe_payment_intent_id: piId,
      type: bt.type,
      gross_pence: btGross,
      stripe_fee_pence: btFee,
      app_fee_pence: ourAppFee,
      net_pence: btNet,
      description: bt.description,
      matched,
    });
  }

  // Insert payout row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payoutRow, error: payoutErr } = await (db.from("payouts") as any).insert({
    stripe_payout_id: payout.id,
    school_id: schoolId,
    arrival_date: new Date(payout.arrival_date * 1000).toISOString().slice(0, 10),
    currency: payout.currency,
    gross_pence: grossPence,
    stripe_fees_pence: stripeFeePence,
    app_fees_pence: appFeePence,
    net_pence: payout.amount,  // Stripe's net figure is canonical
    unmatched_count: unmatchedCount,
    description: payout.description,
  }).select("id").single();

  if (payoutErr || !payoutRow) {
    throw new Error(`Failed to insert payout: ${payoutErr?.message}`);
  }

  if (lineInserts.length > 0) {
    const lines = lineInserts.map((l) => ({ ...l, payout_id: payoutRow.id }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linesErr } = await (db.from("payout_lines") as any).insert(lines);
    if (linesErr) throw new Error(`Failed to insert payout_lines: ${linesErr.message}`);
  }

  if (unmatchedCount > 0) {
    console.warn(
      `[webhook] payout ${payout.id}: ${unmatchedCount} unmatched balance transaction(s) — manual review required`
    );
  }

  console.log(
    `[webhook] payout ${payout.id} reconciled: ${lineInserts.length} lines, ` +
    `gross=${grossPence}p, fees=${stripeFeePence}p, net=${payout.amount}p, unmatched=${unmatchedCount}`
  );
}

// ── charge.refunded ──────────────────────────────────────────────────────────
async function handleChargeRefunded(
  db: ReturnType<typeof serviceClient>,
  charge: Stripe.Charge
): Promise<void> {
  if (!charge.payment_intent) return;

  const piId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent.id;

  // Mark transaction refunded
  const { data: txn } = await db
    .from("transactions")
    .select("id")
    .eq("stripe_payment_intent", piId)
    .maybeSingle();

  if (!txn) return;

  await db
    .from("transactions")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", txn.id);

  // Post reversing double-entry ledger rows (append-only — originals never edited)
  const { data: txnRow } = await db
    .from("transactions")
    .select("amount_pence")
    .eq("id", txn.id)
    .single();

  if (txnRow) {
    await postRefundEntries(db, txn.id, txnRow.amount_pence);
  }

  // Reset assignments back to unpaid
  const { data: txnLines } = await db
    .from("transaction_lines")
    .select("assignment_id, amount_pence")
    .eq("transaction_id", txn.id);

  for (const line of txnLines ?? []) {
    const { data: assignment } = await db
      .from("assignments")
      .select("id, amount_paid_pence")
      .eq("id", line.assignment_id)
      .single();

    if (!assignment) continue;

    const newPaid = Math.max(0, assignment.amount_paid_pence - line.amount_pence);
    await db
      .from("assignments")
      .update({
        amount_paid_pence: newPaid,
        status: newPaid === 0 ? "unpaid" : "partial",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);
  }
}
