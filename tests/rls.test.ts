/**
 * RLS smoke test — proves that each school admin can only see their own students.
 *
 * Requires a real Supabase project (uses service-role key to seed data,
 * then anon-key clients scoped to each admin's session to assert isolation).
 *
 * Run: npx vitest run tests/rls.test.ts
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { Database } from "../src/lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error("Missing Supabase env vars. Copy .env.local values to your test env.");
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── seed data (cleaned up in afterAll) ───────────────────────────────────────

const TAG = `rls-test-${Date.now()}`;

const seedState: {
  trustAId?: string;
  trustBId?: string;
  schoolAId?: string;
  schoolBId?: string;
  studentAId?: string;
  studentBId?: string;
  userAId?: string;
  userBId?: string;
  emailA: string;
  emailB: string;
  password: string;
} = {
  emailA: `${TAG}-a@test.example`,
  emailB: `${TAG}-b@test.example`,
  password: "TestPass123!",
};

async function seed() {
  // Trusts
  const { data: trustA } = await admin.from("trusts").insert({ legal_name: `Trust A (${TAG})` }).select("id").single();
  const { data: trustB } = await admin.from("trusts").insert({ legal_name: `Trust B (${TAG})` }).select("id").single();
  seedState.trustAId = trustA!.id;
  seedState.trustBId = trustB!.id;

  // Schools
  const { data: schoolA } = await admin.from("schools").insert({ trust_id: trustA!.id, name: `School A (${TAG})` }).select("id").single();
  const { data: schoolB } = await admin.from("schools").insert({ trust_id: trustB!.id, name: `School B (${TAG})` }).select("id").single();
  seedState.schoolAId = schoolA!.id;
  seedState.schoolBId = schoolB!.id;

  // Students
  const { data: studentA } = await admin.from("students").insert({ school_id: schoolA!.id, first_name: "Alice", year_group: "Y3" }).select("id").single();
  const { data: studentB } = await admin.from("students").insert({ school_id: schoolB!.id, first_name: "Bob", year_group: "Y4" }).select("id").single();
  seedState.studentAId = studentA!.id;
  seedState.studentBId = studentB!.id;

  // Auth users (email_confirm: true bypasses verification)
  const { data: userA } = await admin.auth.admin.createUser({ email: seedState.emailA, password: seedState.password, email_confirm: true });
  const { data: userB } = await admin.auth.admin.createUser({ email: seedState.emailB, password: seedState.password, email_confirm: true });
  seedState.userAId = userA.user!.id;
  seedState.userBId = userB.user!.id;

  // admin_users rows
  await admin.from("admin_users").insert({ school_id: schoolA!.id, auth_user_id: userA.user!.id, email: seedState.emailA });
  await admin.from("admin_users").insert({ school_id: schoolB!.id, auth_user_id: userB.user!.id, email: seedState.emailB });
}

async function teardown() {
  // Delete in reverse-dependency order; auth user delete cascades admin_users
  if (seedState.studentAId) await admin.from("students").delete().eq("id", seedState.studentAId);
  if (seedState.studentBId) await admin.from("students").delete().eq("id", seedState.studentBId);
  if (seedState.schoolAId) await admin.from("schools").delete().eq("id", seedState.schoolAId);
  if (seedState.schoolBId) await admin.from("schools").delete().eq("id", seedState.schoolBId);
  if (seedState.trustAId) await admin.from("trusts").delete().eq("id", seedState.trustAId);
  if (seedState.trustBId) await admin.from("trusts").delete().eq("id", seedState.trustBId);
  if (seedState.userAId) await admin.auth.admin.deleteUser(seedState.userAId);
  if (seedState.userBId) await admin.auth.admin.deleteUser(seedState.userBId);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("RLS isolation", () => {
  beforeAll(async () => {
    await seed();
  });

  afterAll(async () => {
    await teardown();
  });

  it("admin A sees only their own student", async () => {
    const clientA = createClient<Database>(SUPABASE_URL, ANON_KEY);
    await clientA.auth.signInWithPassword({ email: seedState.emailA, password: seedState.password });

    const { data: students, error } = await clientA.from("students").select("id, first_name");
    expect(error).toBeNull();
    const ids = students!.map((s) => s.id);
    expect(ids).toContain(seedState.studentAId);
    expect(ids).not.toContain(seedState.studentBId);
  });

  it("admin B sees only their own student", async () => {
    const clientB = createClient<Database>(SUPABASE_URL, ANON_KEY);
    await clientB.auth.signInWithPassword({ email: seedState.emailB, password: seedState.password });

    const { data: students, error } = await clientB.from("students").select("id, first_name");
    expect(error).toBeNull();
    const ids = students!.map((s) => s.id);
    expect(ids).toContain(seedState.studentBId);
    expect(ids).not.toContain(seedState.studentAId);
  });

  it("admin A cannot read School B's school row", async () => {
    const clientA = createClient<Database>(SUPABASE_URL, ANON_KEY);
    await clientA.auth.signInWithPassword({ email: seedState.emailA, password: seedState.password });

    const { data: schools } = await clientA.from("schools").select("id");
    const ids = (schools ?? []).map((s) => s.id);
    expect(ids).not.toContain(seedState.schoolBId);
  });
});
