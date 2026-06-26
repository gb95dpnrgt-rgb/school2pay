"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ParsedRow } from "./parseCSV";

function getAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface ImportResult {
  studentsCreated: number;
  studentsSkipped: number;
  guardiansCreated: number;
  linksCreated: number;
  linksSkipped: number;
}

export async function saveImport(rows: ParsedRow[]): Promise<ImportResult> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve admin's school via RLS
  const { data: school } = await supabase.from("schools").select("id").single();
  if (!school) throw new Error("No school found for this admin");

  const schoolId = school.id;
  const admin = getAdminClient();

  // ── Collect unique emails and student keys from the import batch ──────────

  const uniqueEmails = [...new Set(rows.map((r) => r.parent_email))];
  const uniqueStudentKeys = [
    ...new Map(
      rows.map((r) => [`${r.student_first_name.toLowerCase()}|${r.year_group.toLowerCase()}`, r])
    ).values(),
  ];

  // ── Fetch existing records to deduplicate ─────────────────────────────────

  const { data: existingGuardians } = await admin
    .from("guardians")
    .select("id, email")
    .in("email", uniqueEmails);

  const existingGuardianByEmail = new Map(
    (existingGuardians ?? []).map((g) => [g.email, g.id])
  );

  const { data: existingStudents } = await admin
    .from("students")
    .select("id, first_name, year_group")
    .eq("school_id", schoolId);

  const existingStudentByKey = new Map(
    (existingStudents ?? []).map((s) => [
      `${s.first_name.toLowerCase()}|${s.year_group.toLowerCase()}`,
      s.id,
    ])
  );

  // ── Upsert guardians (deduped by email) ───────────────────────────────────

  const guardiansToInsert = uniqueEmails
    .filter((email) => !existingGuardianByEmail.has(email))
    .map((email) => {
      const row = rows.find((r) => r.parent_email === email)!;
      return { email, phone: row.parent_phone || null };
    });

  let guardiansCreated = 0;
  if (guardiansToInsert.length > 0) {
    const { data: inserted } = await admin
      .from("guardians")
      .upsert(guardiansToInsert, { onConflict: "email", ignoreDuplicates: true })
      .select("id, email");
    for (const g of inserted ?? []) {
      existingGuardianByEmail.set(g.email, g.id);
    }
    guardiansCreated = inserted?.length ?? 0;
  }

  // ── Insert new students ───────────────────────────────────────────────────

  const studentsToInsert = uniqueStudentKeys.filter(
    (r) =>
      !existingStudentByKey.has(
        `${r.student_first_name.toLowerCase()}|${r.year_group.toLowerCase()}`
      )
  );

  let studentsCreated = 0;
  const studentsSkipped = uniqueStudentKeys.length - studentsToInsert.length;

  if (studentsToInsert.length > 0) {
    const { data: inserted } = await admin
      .from("students")
      .insert(
        studentsToInsert.map((r) => ({
          school_id: schoolId,
          first_name: r.student_first_name,
          year_group: r.year_group,
        }))
      )
      .select("id, first_name, year_group");

    for (const s of inserted ?? []) {
      existingStudentByKey.set(
        `${s.first_name.toLowerCase()}|${s.year_group.toLowerCase()}`,
        s.id
      );
    }
    studentsCreated = inserted?.length ?? 0;
  }

  // ── Fetch existing guardian_student links to avoid duplicates ─────────────

  const allStudentIds = [...existingStudentByKey.values()];
  const { data: existingLinks } = await admin
    .from("guardian_student")
    .select("guardian_id, student_id")
    .in("student_id", allStudentIds);

  const existingLinkSet = new Set(
    (existingLinks ?? []).map((l) => `${l.guardian_id}|${l.student_id}`)
  );

  // ── Insert guardian_student links ─────────────────────────────────────────

  const linksToInsert = rows
    .map((r) => {
      const guardianId = existingGuardianByEmail.get(r.parent_email);
      const studentId = existingStudentByKey.get(
        `${r.student_first_name.toLowerCase()}|${r.year_group.toLowerCase()}`
      );
      if (!guardianId || !studentId) return null;
      const key = `${guardianId}|${studentId}`;
      if (existingLinkSet.has(key)) return null;
      existingLinkSet.add(key); // prevent duplicates within this batch
      return { guardian_id: guardianId, student_id: studentId, relationship: r.relationship };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const linksSkipped = rows.length - linksToInsert.length - studentsSkipped;

  let linksCreated = 0;
  if (linksToInsert.length > 0) {
    const { data: inserted } = await admin
      .from("guardian_student")
      .insert(linksToInsert)
      .select("guardian_id");
    linksCreated = inserted?.length ?? 0;
  }

  return { studentsCreated, studentsSkipped, guardiansCreated, linksCreated, linksSkipped };
}

export interface RolloverPreview {
  totalStudents: number;
  leaverCount: number;
  promotedCount: number;
  leavingYear: string;
  yearGroups: string[];
}

/** Preview what a rollover will do without committing. */
export async function getRolloverPreview(leavingYear: string): Promise<RolloverPreview> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  const { data: students } = await supabase.from("students").select("id, year_group");
  const all = students ?? [];
  const yearGroups = [...new Set(all.map((s) => s.year_group))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const leaverCount = all.filter((s) => s.year_group === leavingYear).length;

  return {
    totalStudents: all.length,
    leaverCount,
    promotedCount: all.length - leaverCount,
    leavingYear,
    yearGroups,
  };
}

/** Advance all year groups by one step; delete leavers. */
export async function performRollover(leavingYear: string): Promise<{ promoted: number; deleted: number }> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  const { data: school } = await supabase.from("schools").select("id").single();
  if (!school) throw new Error("No school found");

  const admin = getAdminClient();

  const { data: students } = await admin
    .from("students")
    .select("id, year_group")
    .eq("school_id", school.id);

  if (!students?.length) return { promoted: 0, deleted: 0 };

  const yearGroups = [...new Set(students.map((s) => s.year_group))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  // Build next-year map
  const nextYear: Record<string, string> = {};
  for (let i = 0; i < yearGroups.length - 1; i++) {
    nextYear[yearGroups[i]] = yearGroups[i + 1];
  }

  const leavers = students.filter((s) => s.year_group === leavingYear);
  const others = students.filter((s) => s.year_group !== leavingYear);

  if (leavers.length > 0) {
    await admin.from("students").delete().in("id", leavers.map((s) => s.id));
  }

  // Promote highest year groups first to avoid naming collisions
  const yearGroupsToUpdate = [...new Set(others.map((s) => s.year_group))].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  );

  let promoted = 0;
  for (const yg of yearGroupsToUpdate) {
    const next = nextYear[yg];
    if (!next || next === leavingYear) continue;

    const ids = others.filter((s) => s.year_group === yg).map((s) => s.id);
    const { error } = await admin
      .from("students")
      .update({ year_group: next, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) throw new Error(`Failed to promote ${yg}: ${error.message}`);
    promoted += ids.length;
  }

  revalidatePath("/students");
  return { promoted, deleted: leavers.length };
}
