import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { WondeClient } from "@/lib/wonde";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = getAdmin();

  // Find all schools with Wonde credentials
  const { data: schools } = await (admin.from("schools") as any)
    .select("id, name, wonde_token, wonde_school_id")
    .not("wonde_token", "is", null) as {
      data: Array<{ id: string; name: string; wonde_token: string; wonde_school_id: string | null }> | null
    };

  if (!schools?.length) {
    return NextResponse.json({ ok: true, synced: 0, message: "No schools with Wonde configured" });
  }

  const results: Array<{ school: string; students: number; error?: string }> = [];

  for (const school of schools) {
    try {
      const client = new WondeClient(school.wonde_token, school.wonde_school_id ?? undefined);
      const preview = await client.buildPreview();

      // Upsert guardians
      const allGuardians = preview.students.flatMap((s) => s.guardians);
      const uniqueEmails = [...new Set(allGuardians.map((g) => g.email))];

      const { data: existingGuardians } = await admin
        .from("guardians")
        .select("id, email")
        .in("email", uniqueEmails);

      const guardianByEmail = new Map((existingGuardians ?? []).map((g: any) => [g.email, g.id]));

      const guardiansToInsert = uniqueEmails
        .filter((e) => !guardianByEmail.has(e))
        .map((email) => {
          const g = allGuardians.find((g) => g.email === email)!;
          return { email, phone: g.phone };
        });

      if (guardiansToInsert.length > 0) {
        const { data: inserted } = await admin
          .from("guardians")
          .upsert(guardiansToInsert, { onConflict: "email", ignoreDuplicates: true })
          .select("id, email");
        for (const g of inserted ?? []) guardianByEmail.set((g as any).email, (g as any).id);
      }

      // Upsert students
      const { data: existingStudents } = await admin
        .from("students")
        .select("id, first_name, year_group")
        .eq("school_id", school.id);

      const studentByKey = new Map(
        (existingStudents ?? []).map((s: any) => [
          `${s.first_name.toLowerCase()}|${s.year_group.toLowerCase()}`,
          s.id,
        ])
      );

      const studentsToInsert = preview.students.filter(
        (s) => !studentByKey.has(`${s.firstName.toLowerCase()}|${s.yearGroup.toLowerCase()}`)
      );

      if (studentsToInsert.length > 0) {
        const { data: inserted } = await admin
          .from("students")
          .insert(studentsToInsert.map((s) => ({
            school_id: school.id,
            first_name: s.firstName,
            year_group: s.yearGroup,
          })))
          .select("id, first_name, year_group");

        for (const s of inserted ?? []) {
          studentByKey.set(`${(s as any).first_name.toLowerCase()}|${(s as any).year_group.toLowerCase()}`, (s as any).id);
        }
      }

      // Upsert links
      const allStudentIds = [...studentByKey.values()];
      const { data: existingLinks } = await admin
        .from("guardian_student")
        .select("guardian_id, student_id")
        .in("student_id", allStudentIds);

      const linkSet = new Set((existingLinks ?? []).map((l: any) => `${l.guardian_id}|${l.student_id}`));

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

      if (linksToInsert.length > 0) {
        await admin.from("guardian_student").insert(linksToInsert);
      }

      // Update last sync timestamp
      await (admin.from("schools") as any)
        .update({ wonde_last_sync: new Date().toISOString() })
        .eq("id", school.id);

      results.push({ school: school.name, students: preview.totalStudents });
    } catch (err) {
      results.push({
        school: school.name,
        students: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
