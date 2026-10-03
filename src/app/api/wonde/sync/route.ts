import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { fetchWondeStudents, wondeYearGroup } from "@/lib/wonde";
import type { Database } from "@/lib/supabase/types";

const BATCH_SIZE = 20; // students processed per request

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: school } = await (supabase as any)
    .from("schools")
    .select("id, wonde_school_id, wonde_token")
    .single() as { data: { id: string; wonde_school_id: string | null; wonde_token: string | null } | null };

  const wondeSchoolId = school?.wonde_school_id ?? process.env.WONDE_SCHOOL_ID;
  const wondeToken = school?.wonde_token ?? process.env.WONDE_TOKEN;

  if (!wondeSchoolId || !wondeToken) {
    return NextResponse.json({ error: "Wonde not connected" }, { status: 400 });
  }

  // offset lets client step through students in batches
  const body = await req.json().catch(() => ({}));
  const offset: number = body.offset ?? 0;

  const admin = getAdmin();
  let studentsCreated = 0;
  let studentsUpdated = 0;
  let guardiansCreated = 0;

  try {
    // Fetch all students from Wonde (handles pagination internally, fast API call)
    const allStudents = await fetchWondeStudents(wondeSchoolId, wondeToken);
    const total = allStudents.length;
    const batch = allStudents.slice(offset, offset + BATCH_SIZE);

    for (const ws of batch) {
      const yearGroup = wondeYearGroup(ws);

      const { data: existing } = await (admin as any)
        .from("students")
        .select("id")
        .eq("wonde_id", ws.id)
        .eq("school_id", school!.id)
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
          .insert({ school_id: school!.id, first_name: ws.forename, year_group: yearGroup, wonde_id: ws.id })
          .select("id")
          .single() as { data: { id: string } | null };
        if (!newStudent) continue;
        studentId = newStudent.id;
        studentsCreated++;
      }

      const contacts = ws.contacts?.data ?? [];
      for (const contact of contacts) {
        const email = contact.emails?.data?.[0]?.address ?? null;
        const phone = contact.phones?.data?.find((p: any) => p.type === "mobile")?.phone
          ?? contact.phones?.data?.[0]?.phone
          ?? null;

        if (!email) continue;

        let guardianId: string;
        const { data: existingGuardian } = await (admin as any)
          .from("guardians")
          .select("id")
          .eq("wonde_id", contact.id)
          .maybeSingle() as { data: { id: string } | null };

        if (existingGuardian) {
          await (admin as any).from("guardians").update({ email, phone }).eq("id", existingGuardian.id);
          guardianId = existingGuardian.id;
        } else {
          const { data: byEmail } = await (admin as any)
            .from("guardians").select("id").eq("email", email).maybeSingle() as { data: { id: string } | null };

          if (byEmail) {
            await (admin as any).from("guardians").update({ wonde_id: contact.id, phone: phone ?? undefined }).eq("id", byEmail.id);
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

        await (admin as any)
          .from("guardian_student")
          .upsert(
            { guardian_id: guardianId, student_id: studentId, relationship: contact.relationship_to_student ?? "parent" },
            { onConflict: "guardian_id,student_id", ignoreDuplicates: true }
          );
      }
    }

    const nextOffset = offset + BATCH_SIZE;
    const done = nextOffset >= total;

    if (done) {
      await (admin as any)
        .from("schools")
        .update({ wonde_synced_at: new Date().toISOString() })
        .eq("id", school!.id);
    }

    return NextResponse.json({
      ok: true,
      offset,
      next_offset: done ? null : nextOffset,
      done,
      total,
      students_created: studentsCreated,
      students_updated: studentsUpdated,
      guardians_created: guardiansCreated,
    });
  } catch (e: any) {
    console.error("[wonde/sync] error:", e);
    return NextResponse.json({ error: e.message ?? "Sync failed" }, { status: 500 });
  }
}
