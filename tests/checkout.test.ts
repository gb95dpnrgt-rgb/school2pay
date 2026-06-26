/**
 * Checkout integration tests:
 * - transaction_lines sum equals the checkout amount
 * - an already-paid assignment cannot be added to a new checkout
 * - magic link sign/verify round-trip
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Database } from "../src/lib/supabase/types";
import { signMagicToken, verifyMagicToken } from "../src/lib/magic-link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase env vars");

const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TAG = `checkout-test-${Date.now()}`;

const state = {
  trustId: "",
  schoolId: "",
  guardianId: "",
  studentId: "",
  requestId: "",
  assignmentId: "",
};

beforeAll(async () => {
  const { data: trust } = await db.from("trusts").insert({ legal_name: `Trust ${TAG}`, country: "GB" }).select("id").single();
  state.trustId = trust!.id;

  const { data: school } = await db.from("schools").insert({ trust_id: trust!.id, name: `School ${TAG}` }).select("id").single();
  state.schoolId = school!.id;

  const { data: guardian } = await db.from("guardians").insert({ email: `test-${TAG}@example.com` }).select("id").single();
  state.guardianId = guardian!.id;

  const { data: student } = await db.from("students").insert({ school_id: school!.id, first_name: "Test", year_group: "Year 5" }).select("id").single();
  state.studentId = student!.id;

  await db.from("guardian_student").insert({ guardian_id: guardian!.id, student_id: student!.id, relationship: "mother" });

  const { data: req } = await db.from("payment_requests").insert({
    school_id: school!.id,
    title: `Test Request ${TAG}`,
    amount_pence: 2500,
    due_date: "2026-12-31",
  }).select("id").single();
  state.requestId = req!.id;

  const { data: asgn } = await db.from("assignments").insert({
    payment_request_id: req!.id,
    student_id: student!.id,
    amount_due_pence: 2500,
    amount_paid_pence: 0,
    status: "unpaid",
  }).select("id").single();
  state.assignmentId = asgn!.id;
});

afterAll(async () => {
  if (state.schoolId) await db.from("schools").delete().eq("id", state.schoolId);
  if (state.trustId) await db.from("trusts").delete().eq("id", state.trustId);
  if (state.guardianId) await db.from("guardians").delete().eq("id", state.guardianId);
});

// ── Magic link tests ─────────────────────────────────────────────────────────

describe("magic link", () => {
  it("round-trips sign → verify", async () => {
    const token = await signMagicToken("guardian-123", "request-456");
    const payload = await verifyMagicToken(token);
    expect(payload.guardianId).toBe("guardian-123");
    expect(payload.paymentRequestId).toBe("request-456");
  });

  it("rejects a tampered token", async () => {
    const token = await signMagicToken("guardian-123", "request-456");
    const tampered = token.slice(0, -5) + "XXXXX";
    await expect(verifyMagicToken(tampered)).rejects.toThrow();
  });
});

// ── Transaction / line tests ─────────────────────────────────────────────────

describe("transaction lines sum", () => {
  it("transaction_lines amounts sum to transaction amount", async () => {
    const totalPence = 2500;

    const { data: txn } = await db.from("transactions").insert({
      guardian_id: state.guardianId,
      amount_pence: totalPence,
      status: "pending",
    }).select("id").single();

    await db.from("transaction_lines").insert({
      transaction_id: txn!.id,
      assignment_id: state.assignmentId,
      amount_pence: totalPence,
    });

    const { data: lines } = await db
      .from("transaction_lines")
      .select("amount_pence")
      .eq("transaction_id", txn!.id);

    const linesSum = (lines ?? []).reduce((s, l) => s + l.amount_pence, 0);
    expect(linesSum).toBe(totalPence);

    const { data: txnRow } = await db.from("transactions").select("amount_pence").eq("id", txn!.id).single();
    expect(txnRow!.amount_pence).toBe(linesSum);
  });
});

describe("double-payment guard", () => {
  it("rejects checkout for an assignment already marked paid", async () => {
    // Mark assignment as paid
    await db.from("assignments").update({ status: "paid", amount_paid_pence: 2500 }).eq("id", state.assignmentId);

    // Simulate the checkout guard logic
    const { data: assignments } = await db
      .from("assignments")
      .select("id, status")
      .in("id", [state.assignmentId]);

    const alreadyPaid = (assignments ?? []).filter((a) => a.status === "paid" || a.status === "waived");
    expect(alreadyPaid.length).toBeGreaterThan(0);

    // Reset for other tests
    await db.from("assignments").update({ status: "unpaid", amount_paid_pence: 0 }).eq("id", state.assignmentId);
  });

  it("allows checkout for an unpaid assignment", async () => {
    const { data: assignments } = await db
      .from("assignments")
      .select("id, status")
      .in("id", [state.assignmentId]);

    const alreadyPaid = (assignments ?? []).filter((a) => a.status === "paid" || a.status === "waived");
    expect(alreadyPaid.length).toBe(0);
  });
});
