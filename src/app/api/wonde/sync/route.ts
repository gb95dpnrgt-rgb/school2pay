import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { fetchWondeStudents, wondeYearGroup } from "@/lib/wonde";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Fetch school with Wonde credentials
  const { data: school } = await (supabase as any)
    .from("schools")
    .select("id, school_id, wonde_school_id, wonde_token")
    .single() as { data: { id: string; wonde_school_id: string | null; wonde_token: string | null } | null };

  if (!school?.wonde_school_id || !school?.wonde_token) {
    return NextResponse.json({ error: "Wonde not connected" }, { status: 400 });
  }

  const admin = getAdmin();

  let studentsCreated = 0;
  let studentsUpdated = 0;
  let guardiansCreated = 0;

  try {
    const wondeStudents = await fetchWondeStudents(school.wonde_school_id, school.wonde_token);

    for (const ws of wondeStudents) {
      const yearGroup = wondeYearGroup(ws);

      // Upsert student by wonde_id
      const { data: existing } = await (admin as any)
        .from("students")
        .select("id")
        .eq("wonde_id", ws.id)
        .eq("school_id", school.id)
        .maybeSingle() as { data: { id: string } | null };

      let studentId: string;

      if (existing) {
        await (admin as any)
          .from("students")
          .update({ first_name: ws.forename, year_group: yearGroup })
          .eq("id", existing.id);
        studentId = existing.id;
        studentsUpdated++;
      } else {
        const { data: newStudent } = await (admin as any)
          .from("students")
          .insert({ school_id: school.id, first_name: ws.forename, year_group: yearGroup, wonde_id: ws.id })
          .select("id")
          .single() as { data: { id: string } | null };
        if (!newStudent) continue;
        studentId = newStudent.id;
        studentsCreated++;
      }

      // Upsert guardians (contacts)
      const contacts = ws.contacts?.data ?? [];
      for (const contact of contacts) {
        const email = contact.emails?.data?.[0]?.address ?? null;
        const phone = contact.phones?.data?.find((p) => p.type === "mobile")?.phone
          ?? contact.phones?.data?.[0]?.phone
          ?? null;

        if (!email) continue; // can't send magic link without email

        // Find or create guardian by wonde_id
        let guardianId: string;
        const { data: existingGuardian } = await (admin as any)
          .from("guardians")
          .select("id")
          .eq("wonde_id", contact.id)
          .maybeSingle() as { data: { id: string } | null };

        if (existingGuardian) {
          await (admin as any)
            .from("guardians")
            .update({ email, phone })
            .eq("id", existingGuardian.id);
          guardianId = existingGuardian.id;
        } else {
          // Check if guardian already exists by email (manual entry may pre-exist)
          const { data: byEmail } = await (admin as any)
            .from("guardians")
            .select("id")
            .eq("email", email)
            .maybeSingle() as { data: { id: string } | null };

          if (byEmail) {
            await (admin as any)
              .from("guardians")
              .update({ wonde_id: contact.id, phone: phone ?? undefined })
              .eq("id", byEmail.id);
            guardianId = byEmail.id;
          } else {
            const { data: newGuardian } = await (admin as any)
              .from("guardians")
              .insert({ email, phone, wonde_id: contact.id })
              .select("id")
              .single() as { data: { id: string } | null };
            if (!newGuardian) continue;
            guardianId = newGuardian.id;
            guardiansCreated++;
          }
        }

        // Ensure guardian_student link exists
        await (admin as any)
          .from("guardian_student")
          .upsert(
            { guardian_id: guardianId, student_id: studentId, relationship: contact.relationship_to_student ?? "parent" },
            { onConflict: "guardian_id,student_id", ignoreDuplicates: true }
          );
      }
    }

    // Record last sync time
    await (admin as any)
      .from("schools")
      .update({ wonde_synced_at: new Date().toISOString() })
      .eq("id", school.id);

    return NextResponse.json({
      ok: true,
      students_created: studentsCreated,
      students_updated: studentsUpdated,
      guardians_created: guardiansCreated,
      total: wondeStudents.length,
    });
  } catch (e: any) {
    console.error("[wonde/sync] error:", e);
    return NextResponse.json({ error: e.message ?? "Sync failed" }, { status: 500 });
  }
}
