/**
 * Fan-out integration tests — verifies assignment creation logic.
 *
 * Uses the service-role client to seed data and assert correctness.
 * Run: npx vitest run tests/fanout.test.ts
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { Database } from "../src/lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase env vars.");
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TAG = `fanout-test-${Date.now()}`;

const state = {
  trustId: "",
  schoolId: "",
  studentIds: [] as string[],
  y5StudentIds: [] as string[],
  y6StudentIds: [] as string[],
  requestIds: [] as string[],
};

beforeAll(async () => {
  // Trust
  const { data: trust } = await db
    .from("trusts")
    .insert({ legal_name: `Test Trust ${TAG}`, country: "GB" })
    .select("id")
    .single();
  state.trustId = trust!.id;

  // School
  const { data: school } = await db
    .from("schools")
    .insert({ trust_id: trust!.id, name: `Test School ${TAG}` })
    .select("id")
    .single();
  state.schoolId = school!.id;

  // Students: 3 Year 5, 2 Year 6
  const { data: students } = await db
    .from("students")
    .insert([
      { school_id: school!.id, first_name: "A", year_group: "Year 5" },
      { school_id: school!.id, first_name: "B", year_group: "Year 5" },
      { school_id: school!.id, first_name: "C", year_group: "Year 5" },
      { school_id: school!.id, first_name: "D", year_group: "Year 6" },
      { school_id: school!.id, first_name: "E", year_group: "Year 6" },
    ])
    .select("id, year_group");

  state.studentIds = (students ?? []).map((s) => s.id);
  state.y5StudentIds = (students ?? []).filter((s) => s.year_group === "Year 5").map((s) => s.id);
  state.y6StudentIds = (students ?? []).filter((s) => s.year_group === "Year 6").map((s) => s.id);
});

afterAll(async () => {
  // Clean up in order (FK cascades handle assignments and payment_requests)
  if (state.schoolId) {
    await db.from("schools").delete().eq("id", state.schoolId);
  }
  if (state.trustId) {
    await db.from("trusts").delete().eq("id", state.trustId);
  }
});

async function fanOut(
  schoolId: string,
  amountPence: number,
  yearGroups: string[] | null
): Promise<string> {
  const { data: req } = await db
    .from("payment_requests")
    .insert({
      school_id: schoolId,
      title: `Test Request ${TAG}`,
      amount_pence: amountPence,
      due_date: "2026-12-31",
      year_groups: yearGroups,
    })
    .select("id")
    .single();

  state.requestIds.push(req!.id);

  let query = db.from("students").select("id").eq("school_id", schoolId);
  if (yearGroups) query = query.in("year_group", yearGroups);
  const { data: students } = await query;

  const assignments = (students ?? []).map((s) => ({
    payment_request_id: req!.id,
    student_id: s.id,
    amount_due_pence: amountPence,
    amount_paid_pence: 0,
    status: "unpaid" as const,
  }));

  if (assignments.length > 0) {
    await db.from("assignments").insert(assignments);
  }

  return req!.id;
}

describe("fan-out: whole school", () => {
  it("creates exactly one assignment per student when targeting whole school", async () => {
    const reqId = await fanOut(state.schoolId, 2500, null);

    const { data: assignments } = await db
      .from("assignments")
      .select("student_id")
      .eq("payment_request_id", reqId);

    expect(assignments).toHaveLength(5); // 3 Y5 + 2 Y6

    const assignedIds = (assignments ?? []).map((a) => a.student_id).sort();
    expect(assignedIds).toEqual([...state.studentIds].sort());
  });
});

describe("fan-out: year group targeting", () => {
  it("only creates assignments for Year 5 students when targeting Year 5", async () => {
    const reqId = await fanOut(state.schoolId, 1500, ["Year 5"]);

    const { data: assignments } = await db
      .from("assignments")
      .select("student_id")
      .eq("payment_request_id", reqId);

    expect(assignments).toHaveLength(3);

    const assignedIds = (assignments ?? []).map((a) => a.student_id).sort();
    expect(assignedIds).toEqual([...state.y5StudentIds].sort());
  });

  it("only creates assignments for Year 6 students when targeting Year 6", async () => {
    const reqId = await fanOut(state.schoolId, 1500, ["Year 6"]);

    const { data: assignments } = await db
      .from("assignments")
      .select("student_id")
      .eq("payment_request_id", reqId);

    expect(assignments).toHaveLength(2);

    const assignedIds = (assignments ?? []).map((a) => a.student_id).sort();
    expect(assignedIds).toEqual([...state.y6StudentIds].sort());
  });

  it("creates no assignments if target year group has no students", async () => {
    const reqId = await fanOut(state.schoolId, 1000, ["Year 7"]);

    const { data: assignments } = await db
      .from("assignments")
      .select("student_id")
      .eq("payment_request_id", reqId);

    expect(assignments).toHaveLength(0);
  });
});

describe("fan-out: amount correctness", () => {
  it("every assignment has amount_due_pence matching the request amount", async () => {
    const reqId = await fanOut(state.schoolId, 3000, null);

    const { data: assignments } = await db
      .from("assignments")
      .select("amount_due_pence, amount_paid_pence, status")
      .eq("payment_request_id", reqId);

    for (const a of assignments ?? []) {
      expect(a.amount_due_pence).toBe(3000);
      expect(a.amount_paid_pence).toBe(0);
      expect(a.status).toBe("unpaid");
    }
  });
});
