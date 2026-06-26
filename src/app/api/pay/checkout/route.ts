import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { verifyMagicToken } from "@/lib/magic-link";
import { APPLICATION_FEE_PENCE } from "@/lib/fees";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  let body: { guardianId: string; paymentRequestId: string; assignmentIds: string[]; token: string; partialAmounts?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { guardianId, paymentRequestId, assignmentIds, token, partialAmounts } = body;

  // Verify magic link token — expiry and guardian scope
  try {
    const payload = await verifyMagicToken(decodeURIComponent(token));
    if (payload.guardianId !== guardianId || payload.paymentRequestId !== paymentRequestId) {
      return NextResponse.json({ error: "Token mismatch" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 403 });
  }

  if (!assignmentIds?.length) {
    return NextResponse.json({ error: "No items selected" }, { status: 400 });
  }

  const admin = getAdmin();

  // Fetch assignments — verify they belong to this guardian + request, and are unpaid
  const { data: assignments } = await admin
    .from("assignments")
    .select(`
      id, amount_due_pence, status,
      payment_request_id,
      students!inner(
        guardian_student!inner(guardian_id)
      )
    `)
    .eq("payment_request_id", paymentRequestId)
    .in("id", assignmentIds) as {
      data: Array<{
        id: string; amount_due_pence: number; status: string; payment_request_id: string;
        students: { guardian_student: Array<{ guardian_id: string }> };
      }> | null;
    };

  if (!assignments?.length) {
    return NextResponse.json({ error: "Assignments not found" }, { status: 404 });
  }

  // Reject if the payment request has been closed by the school
  const { data: paymentReq } = await admin
    .from("payment_requests")
    .select("status")
    .eq("id", paymentRequestId)
    .single();

  if (paymentReq?.status === "closed") {
    return NextResponse.json({ error: "This payment request is no longer accepting payments" }, { status: 410 });
  }

  // Race condition guard: reject if any assignment is already paid or waived
  const alreadyPaid = assignments.filter((a) => a.status === "paid" || a.status === "waived");
  if (alreadyPaid.length > 0) {
    return NextResponse.json({ error: "One or more items have already been paid" }, { status: 409 });
  }

  // C1 guard: reject if any assignment already has an active (pending/succeeded) transaction line.
  // This closes the concurrent-checkout race: two parents cannot both create checkouts for the
  // same assignment because the second INSERT to transaction_lines will conflict.
  const { data: existingLines } = await admin
    .from("transaction_lines")
    .select("assignment_id, transactions!inner(status)")
    .in("assignment_id", assignmentIds) as {
      data: Array<{ assignment_id: string; transactions: { status: string } }> | null;
    };

  const activeLines = (existingLines ?? []).filter(
    (l) => l.transactions.status === "pending" || l.transactions.status === "succeeded"
  );
  if (activeLines.length > 0) {
    return NextResponse.json({ error: "A payment for one or more items is already in progress" }, { status: 409 });
  }

  // Verify all assignments belong to this guardian
  const unauthorised = assignments.filter(
    (a) => !a.students.guardian_student.some((gs) => gs.guardian_id === guardianId)
  );
  if (unauthorised.length > 0) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  // If partial amounts provided, validate each is ≥ £1 and ≤ remaining balance
  if (partialAmounts) {
    for (const a of assignments) {
      const pence = partialAmounts[a.id];
      if (!Number.isInteger(pence) || pence < 100) {
        return NextResponse.json({ error: "Minimum partial payment is £1.00" }, { status: 400 });
      }
      if (pence > a.amount_due_pence) {
        return NextResponse.json({ error: "Partial amount exceeds amount due" }, { status: 400 });
      }
    }
  }

  const totalPence = partialAmounts
    ? assignments.reduce((s, a) => s + (partialAmounts[a.id] ?? a.amount_due_pence), 0)
    : assignments.reduce((s, a) => s + a.amount_due_pence, 0);

  // Fetch trust stripe_account_id via payment_request → school → trust
  const { data: reqRow } = await admin
    .from("payment_requests")
    .select("school_id, schools!inner(trust_id, trusts!inner(stripe_account_id))")
    .eq("id", paymentRequestId)
    .single() as {
      data: {
        school_id: string;
        schools: { trust_id: string; trusts: { stripe_account_id: string | null } };
      } | null;
    };

  const stripeAccountId = (reqRow?.schools as unknown as { trusts: { stripe_account_id: string | null } })?.trusts?.stripe_account_id;

  // Create pending transaction
  const { data: txn, error: txnErr } = await admin
    .from("transactions")
    .insert({
      guardian_id: guardianId,
      amount_pence: totalPence,
      status: "pending",
    })
    .select("id")
    .single();

  if (txnErr || !txn) {
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }

  // Create transaction lines — use partial amounts if provided
  const lines = assignments.map((a) => ({
    transaction_id: txn.id,
    assignment_id: a.id,
    amount_pence: partialAmounts ? (partialAmounts[a.id] ?? a.amount_due_pence) : a.amount_due_pence,
  }));

  const { error: linesErr } = await admin.from("transaction_lines").insert(lines);
  if (linesErr) {
    return NextResponse.json({ error: "Failed to create transaction lines" }, { status: 500 });
  }

  // Create Stripe Checkout session
  const successUrl = `${APP_URL}/pay/success?txn=${txn.id}`;
  const cancelUrl = `${APP_URL}/pay/${encodeURIComponent(token)}`;

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: { name: "School payment" },
          unit_amount: totalPence,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { transaction_id: txn.id },
  };

  // Add application fee if connected account available
  if (stripeAccountId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: APPLICATION_FEE_PENCE,
      transfer_data: { destination: stripeAccountId },
    };
  }

  // C2 fix: if Stripe session creation fails, delete the transaction row (cascades to lines)
  // so the parent can retry cleanly without orphaned pending rows blocking future attempts.
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    await admin.from("transactions").delete().eq("id", txn.id);
    console.error("[checkout] Stripe session creation failed, transaction rolled back:", err);
    return NextResponse.json({ error: "Payment session could not be created" }, { status: 502 });
  }

  // Store payment intent ID on transaction
  if (session.payment_intent) {
    await admin
      .from("transactions")
      .update({ stripe_payment_intent: session.payment_intent as string })
      .eq("id", txn.id);
  }

  return NextResponse.json({ url: session.url });
}
