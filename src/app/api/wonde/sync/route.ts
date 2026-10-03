import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { wondeYearGroup } from "@/lib/wonde";
import type { Database } from "@/lib/supabase/types";

const WONDE_BASE = "https://api.wonde.com/v1.0";
const BATCH_SIZE = 15; // students per request — keeps well within 10s Hobby limit

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Fetch a single page of students from Wonde
async function fetchWondePage(wondeSchoolId: string, token: string, page: number) {
  const url = `${WONDE_BASE}/schools/${wondeSchoolId}/students?include=contacts,year&per_page=${BATCH_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wonde API error ${res.status}: ${text}`);
  }
  const json = await res.json();
  const totalPages = json.meta?.pagination?.total_pages ?? 1;
  return { students: json.data ?? [], totalPages };
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

  // page param allows client to loop through all pages
  const body = await req.json().catch(() => ({}));
  const page: number = body.page ?? 1;

  const admin = getAdmin();
  let studentsCreated = 0;
  let studentsUpdated = 0;
  let guardiansCreated = 0;

  try {
    const { students: wondeStudents, totalPages } = await fetchWondePage(wondeSchoolId, wondeToken, page);

    for (const ws of wondeStudents) {
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

    const done = page >= totalPages;

    if (done) {
      await (admin as any)
        .from("schools")
        .update({ wonde_synced_at: new Date().toISOString() })
        .eq("id", school!.id);
    }

    return NextResponse.json({
      ok: true,
      page,
      total_pages: totalPages,
      done,
      students_created: studentsCreated,
      students_updated: studentsUpdated,
      guardians_created: guardiansCreated,
    });
  } catch (e: any) {
    console.error("[wonde/sync] error:", e);
    return NextResponse.json({ error: e.message ?? "Sync failed" }, { status: 500 });
  }
}
