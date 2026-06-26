import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { postPaymentEntries, postRefundEntries } from "@/lib/ledger";
import { sendPaymentConfirmation } from "@/lib/email";

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

// ── payment_intent.succeeded ─────────────────────────────────────────────────
async function handlePaymentSucceeded(
  db: ReturnType<typeof serviceClient>,
  pi: Stripe.PaymentIntent
): Promise<void> {
  // Find our transaction by payment_intent id
  const { data: txn } = await db
    .from("transactions")
    .select("id, amount_pence, status")
    .eq("stripe_payment_intent", pi.id)
    .maybeSingle();

  if (!txn) {
    console.warn(`[webhook] no transaction found for PI: ${pi.id}`);
    return;
  }

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

  // Send confirmation email to guardian
  const { data: txnFull } = await db
    .from("transactions")
    .select(`
      guardian_id,
      transaction_lines(
        amount_pence,
        assignments(
          amount_due_pence,
          students(first_name, year_group)
        )
      )
    `)
    .eq("id", txn.id)
    .single();

  if (txnFull?.guardian_id) {
    const { data: guardian } = await db
      .from("guardians")
      .select("email")
      .eq("id", txnFull.guardian_id)
      .single();

    const { data: txnLine0 } = await db
      .from("transaction_lines")
      .select("assignment_id")
      .eq("transaction_id", txn.id)
      .limit(1)
      .single();

    let requestTitle = "";
    let schoolName = "";

    if (txnLine0) {
      const { data: assignment } = await db
        .from("assignments")
        .select("payment_request_id")
        .eq("id", txnLine0.assignment_id)
        .single();

      if (assignment) {
        const { data: req } = await db
          .from("payment_requests")
          .select("title, schools(name)")
          .eq("id", assignment.payment_request_id)
          .single() as { data: { title: string; schools: { name: string } | null } | null };

        requestTitle = req?.title ?? "";
        schoolName = (req?.schools as { name: string } | null)?.name ?? "";
      }
    }

    const lines = (txnFull.transaction_lines ?? []) as Array<{
      amount_pence: number;
      assignments: { amount_due_pence: number; students: { first_name: string; year_group: string } | null } | null;
    }>;

    const children = lines
      .filter((l) => l.assignments?.students)
      .map((l) => ({
        firstName: l.assignments!.students!.first_name,
        yearGroup: l.assignments!.students!.year_group,
        amountPence: l.amount_pence,
      }));

    if (guardian?.email && children.length > 0 && requestTitle) {
      await sendPaymentConfirmation({
        email: guardian.email,
        requestTitle,
        schoolName,
        children,
      });
    }
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
