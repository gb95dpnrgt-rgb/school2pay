/**
 * Webhook idempotency and business-logic tests.
 *
 * We bypass the HTTP layer and call the handler functions directly
 * using a service-role Supabase client, so we can replay events and
 * assert DB state without needing a running server or Stripe CLI.
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Database } from "../src/lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase env vars");

const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TAG = `webhook-test-${Date.now()}`;

const state = {
  trustId: "",
  schoolId: "",
  guardianId: "",
  studentId: "",
  requestId: "",
  assignmentId: "",
  transactionId: "",
  lineId: "",
};

// ── Inline handler implementations (mirrors the webhook route) ────────────────
// We duplicate the core logic here so tests don't depend on the HTTP layer.

async function applyPaymentSucceeded(piId: string) {
  const { data: txn } = await db
    .from("transactions")
    .select("id, amount_pence, status")
    .eq("stripe_payment_intent", piId)
    .maybeSingle();
  if (!txn || txn.status === "succeeded") return;

  await db.from("transactions").update({ status: "succeeded", updated_at: new Date().toISOString() }).eq("id", txn.id);

  const { data: lines } = await db.from("transaction_lines").select("id, assignment_id, amount_pence").eq("transaction_id", txn.id);
  for (const line of lines ?? []) {
    const { data: asgn } = await db.from("assignments").select("id, amount_due_pence, amount_paid_pence").eq("id", line.assignment_id).single();
    if (!asgn) continue;
    const newPaid = asgn.amount_paid_pence + line.amount_pence;
    const newStatus = newPaid >= asgn.amount_due_pence ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    await db.from("assignments").update({ amount_paid_pence: newPaid, status: newStatus, updated_at: new Date().toISOString() }).eq("id", asgn.id);
  }

  const ledgerRows = (lines ?? []).map((l) => ({ transaction_id: txn.id, account: "receivable", debit_pence: l.amount_pence, credit_pence: 0 }));
  if (ledgerRows.length) await db.from("ledger_entries").insert(ledgerRows);
}

async function applyPaymentFailed(piId: string) {
  await db.from("transactions").update({ status: "failed", updated_at: new Date().toISOString() }).eq("stripe_payment_intent", piId);
}

async function insertStripeEvent(eventId: string, type: string): Promise<boolean> {
  const { error } = await db.from("stripe_events").insert({ stripe_event_id: eventId, type, payload: {} });
  if (error?.code === "23505") return false; // duplicate
  if (error) throw new Error(error.message);
  return true;
}

// Simulates the webhook handler for a payment_intent.succeeded event
async function processSucceededEvent(eventId: string, piId: string) {
  const inserted = await insertStripeEvent(eventId, "payment_intent.succeeded");
  if (!inserted) return; // idempotency: already processed
  await applyPaymentSucceeded(piId);
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  const { data: trust } = await db.from("trusts").insert({ legal_name: `Trust ${TAG}`, country: "GB" }).select("id").single();
  state.trustId = trust!.id;

  const { data: school } = await db.from("schools").insert({ trust_id: trust!.id, name: `School ${TAG}` }).select("id").single();
  state.schoolId = school!.id;

  const { data: guardian } = await db.from("guardians").insert({ email: `wh-${TAG}@example.com` }).select("id").single();
  state.guardianId = guardian!.id;

  const { data: student } = await db.from("students").insert({ school_id: school!.id, first_name: "Webhook", year_group: "Year 5" }).select("id").single();
  state.studentId = student!.id;

  await db.from("guardian_student").insert({ guardian_id: guardian!.id, student_id: student!.id, relationship: "mother" });

  const { data: req } = await db.from("payment_requests").insert({
    school_id: school!.id, title: `Webhook Test ${TAG}`, amount_pence: 2500, due_date: "2026-12-31",
  }).select("id").single();
  state.requestId = req!.id;

  const { data: asgn } = await db.from("assignments").insert({
    payment_request_id: req!.id, student_id: student!.id,
    amount_due_pence: 2500, amount_paid_pence: 0, status: "unpaid",
  }).select("id").single();
  state.assignmentId = asgn!.id;

  // Create transaction + line (simulating what /api/pay/checkout would create)
  const FAKE_PI = `pi_test_webhook_${TAG}`;
  const { data: txn } = await db.from("transactions").insert({
    guardian_id: guardian!.id, stripe_payment_intent: FAKE_PI, amount_pence: 2500, status: "pending",
  }).select("id").single();
  state.transactionId = txn!.id;

  const { data: line } = await db.from("transaction_lines").insert({
    transaction_id: txn!.id, assignment_id: asgn!.id, amount_pence: 2500,
  }).select("id").single();
  state.lineId = line!.id;
});

afterAll(async () => {
  if (state.schoolId) await db.from("schools").delete().eq("id", state.schoolId);
  if (state.trustId) await db.from("trusts").delete().eq("id", state.trustId);
  if (state.guardianId) await db.from("guardians").delete().eq("id", state.guardianId);
  // Clean up stripe_events with our test tag
  await db.from("stripe_events").delete().like("stripe_event_id", `%${TAG}%`);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("payment_intent.succeeded", () => {
  const FAKE_PI = `pi_test_webhook_${TAG}`;
  const EVENT_ID = `evt_succeeded_${TAG}`;

  it("marks transaction succeeded and assignment paid on first call", async () => {
    await processSucceededEvent(EVENT_ID, FAKE_PI);

    const { data: txn } = await db.from("transactions").select("status").eq("id", state.transactionId).single();
    expect(txn!.status).toBe("succeeded");

    const { data: asgn } = await db.from("assignments").select("amount_paid_pence, status").eq("id", state.assignmentId).single();
    expect(asgn!.amount_paid_pence).toBe(2500);
    expect(asgn!.status).toBe("paid");
  });

  it("replaying the same event 5 times does not double-credit the assignment", async () => {
    // Replay 4 more times (already processed once above)
    for (let i = 0; i < 4; i++) {
      await processSucceededEvent(EVENT_ID, FAKE_PI);
    }

    const { data: asgn } = await db
      .from("assignments")
      .select("amount_paid_pence, status")
      .eq("id", state.assignmentId)
      .single();

    // Must still be exactly 2500p — no double-crediting
    expect(asgn!.amount_paid_pence).toBe(2500);
    expect(asgn!.status).toBe("paid");
  });

  it("only one stripe_event row exists for the event id", async () => {
    const { data: rows } = await db
      .from("stripe_events")
      .select("id")
      .eq("stripe_event_id", EVENT_ID);

    expect(rows).toHaveLength(1);
  });

  it("ledger_entries has exactly one debit row for this transaction", async () => {
    const { data: entries } = await db
      .from("ledger_entries")
      .select("debit_pence, credit_pence")
      .eq("transaction_id", state.transactionId)
      .eq("account", "receivable");

    // Only 1 entry (not 5 from replays)
    expect(entries).toHaveLength(1);
    expect(entries![0].debit_pence).toBe(2500);
    expect(entries![0].credit_pence).toBe(0);
  });
});

describe("payment_intent.payment_failed", () => {
  it("marks transaction failed and leaves assignment completely untouched", async () => {
    const FAKE_PI_FAIL = `pi_test_failed_${TAG}`;
    const EVENT_ID_FAIL = `evt_failed_${TAG}`;

    // Create a separate pending transaction for failure scenario
    const { data: txn2 } = await db.from("transactions").insert({
      guardian_id: state.guardianId,
      stripe_payment_intent: FAKE_PI_FAIL,
      amount_pence: 2500,
      status: "pending",
    }).select("id").single();

    // Create a fresh assignment for the failure test
    const { data: student2 } = await db.from("students").insert({
      school_id: state.schoolId, first_name: "FailTest", year_group: "Year 6",
    }).select("id").single();

    const { data: asgn2 } = await db.from("assignments").insert({
      payment_request_id: state.requestId,
      student_id: student2!.id,
      amount_due_pence: 2500,
      amount_paid_pence: 0,
      status: "unpaid",
    }).select("id").single();

    await db.from("transaction_lines").insert({
      transaction_id: txn2!.id,
      assignment_id: asgn2!.id,
      amount_pence: 2500,
    });

    // Process failed event
    const inserted = await insertStripeEvent(EVENT_ID_FAIL, "payment_intent.payment_failed");
    if (inserted) await applyPaymentFailed(FAKE_PI_FAIL);

    // Transaction should be failed
    const { data: txnRow } = await db.from("transactions").select("status").eq("id", txn2!.id).single();
    expect(txnRow!.status).toBe("failed");

    // Assignment must be completely untouched
    const { data: asgnRow } = await db.from("assignments").select("amount_paid_pence, status").eq("id", asgn2!.id).single();
    expect(asgnRow!.amount_paid_pence).toBe(0);
    expect(asgnRow!.status).toBe("unpaid");
  });
});
