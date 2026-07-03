"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { WondeClient } from "@/lib/wonde";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type WondePreviewResult = {
  ok: true;
  schoolName: string;
  totalStudents: number;
  totalGuardians: number;
  students: Array<{
    firstName: string;
    yearGroup: string;
    guardians: Array<{ email: string; phone: string | null; relationship: string }>;
  }>;
} | { ok: false; error: string };

/** Validate token + school ID and return a preview of what will be imported */
export async function previewWondeSync(formData: FormData): Promise<WondePreviewResult> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = (formData.get("wonde_token") as string).trim();
  const schoolId = (formData.get("wonde_school_id") as string).trim();

  if (!token) return { ok: false, error: "Wonde API token is required" };

  try {
    const client = new WondeClient(token, schoolId || undefined);
    const preview = await client.buildPreview();
    return { ok: true, ...preview };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("401")) return { ok: false, error: "Invalid API token — check your Wonde credentials" };
    if (msg.includes("404")) return { ok: false, error: "School not found — check your Wonde school ID" };
    return { ok: false, error: `Wonde API error: ${msg}` };
  }
}

export type WondeSyncResult = {
  studentsCreated: number;
  studentsSkipped: number;
  guardiansCreated: number;
  linksCreated: number;
};

/** Confirm and run the full sync — same upsert logic as CSV import */
export async function confirmWondeSync(formData: FormData): Promise<WondeSyncResult> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id").single();
  if (!school) throw new Error("No school found for this admin");

  const token = (formData.get("wonde_token") as string).trim();
  const schoolId = (formData.get("wonde_school_id") as string).trim();

  const client = new WondeClient(token, schoolId || undefined);
  const preview = await client.buildPreview();

  const admin = getAdmin();
  const schoolDbId = school.id;

  // Collect all unique emails
  const allGuardians = preview.students.flatMap((s) => s.guardians);
  const uniqueEmails = [...new Set(allGuardians.map((g) => g.email))];

  // Fetch existing guardians
  const { data: existingGuardians } = await admin
    .from("guardians")
    .select("id, email")
    .in("email", uniqueEmails);

  const guardianByEmail = new Map((existingGuardians ?? []).map((g) => [g.email, g.id]));

  // Upsert guardians
  const guardiansToInsert = uniqueEmails
    .filter((e) => !guardianByEmail.has(e))
    .map((email) => {
      const g = allGuardians.find((g) => g.email === email)!;
      return { email, phone: g.phone };
    });

  let guardiansCreated = 0;
  if (guardiansToInsert.length > 0) {
    const { data: inserted } = await admin
      .from("guardians")
      .upsert(guardiansToInsert, { onConflict: "email", ignoreDuplicates: true })
      .select("id, email");
    for (const g of inserted ?? []) guardianByEmail.set(g.email, g.id);
    guardiansCreated = inserted?.length ?? 0;
  }

  // Fetch existing students
  const { data: existingStudents } = await admin
    .from("students")
    .select("id, first_name, year_group")
    .eq("school_id", schoolDbId);

  const studentByKey = new Map(
    (existingStudents ?? []).map((s) => [
      `${s.first_name.toLowerCase()}|${s.year_group.toLowerCase()}`,
      s.id,
    ])
  );

  // Insert new students
  const studentsToInsert = preview.students.filter(
    (s) => !studentByKey.has(`${s.firstName.toLowerCase()}|${s.yearGroup.toLowerCase()}`)
  );

  let studentsCreated = 0;
  const studentsSkipped = preview.students.length - studentsToInsert.length;

  if (studentsToInsert.length > 0) {
    const { data: inserted } = await admin
      .from("students")
      .insert(studentsToInsert.map((s) => ({
        school_id: schoolDbId,
        first_name: s.firstName,
        year_group: s.yearGroup,
      })))
      .select("id, first_name, year_group");

    for (const s of inserted ?? []) {
      studentByKey.set(`${s.first_name.toLowerCase()}|${s.year_group.toLowerCase()}`, s.id);
    }
    studentsCreated = inserted?.length ?? 0;
  }

  // Fetch existing links
  const allStudentIds = [...studentByKey.values()];
  const { data: existingLinks } = await admin
    .from("guardian_student")
    .select("guardian_id, student_id")
    .in("student_id", allStudentIds);

  const linkSet = new Set((existingLinks ?? []).map((l) => `${l.guardian_id}|${l.student_id}`));

  // Insert new links
  const linksToInsert = preview.students.flatMap((s) => {
    const studentId = studentByKey.get(`${s.firstName.toLowerCase()}|${s.yearGroup.toLowerCase()}`);
    if (!studentId) return [];
    return s.guardians.flatMap((g) => {
      const guardianId = guardianByEmail.get(g.email);
      if (!guardianId) return [];
      const key = `${guardianId}|${studentId}`;
      if (linkSet.has(key)) return [];
      linkSet.add(key);
      return [{ guardian_id: guardianId, student_id: studentId, relationship: g.relationship }];
    });
  });

  let linksCreated = 0;
  if (linksToInsert.length > 0) {
    const { data: inserted } = await admin
      .from("guardian_student")
      .insert(linksToInsert)
      .select("guardian_id");
    linksCreated = inserted?.length ?? 0;
  }

  // Save Wonde credentials against the school for auto-sync
  await (admin.from("schools") as any).update({
    wonde_token: token,
    wonde_school_id: schoolId || null,
    wonde_last_sync: new Date().toISOString(),
  }).eq("id", schoolDbId);

  revalidatePath("/students");
  return { studentsCreated, studentsSkipped, guardiansCreated, linksCreated };
}
