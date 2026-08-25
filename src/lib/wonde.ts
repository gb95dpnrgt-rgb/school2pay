const WONDE_BASE = "https://api.wonde.com/v1.0";

export interface WondeStudent {
  id: string;
  forename: string;
  year: { data?: { name: string } };
  classes?: { data: { name: string }[] };
  contacts?: {
    data: {
      email?: { address: string };
      telephone?: { number: string };
      relationship_to_student?: string;
      parental_responsibility: boolean;
    }[];
  };
}

async function wondeGet(path: string, schoolToken: string) {
  const res = await fetch(`${WONDE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${schoolToken}` },
  });
  if (!res.ok) throw new Error(`Wonde API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function syncSchoolFromWonde(
  schoolToken: string,
  schoolId: string
): Promise<{ students: number; guardians: number; links: number }> {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let page = 1;
  let hasMore = true;
  let totalStudents = 0;
  let totalGuardians = 0;
  let totalLinks = 0;

  while (hasMore) {
    const { data, meta } = await wondeGet(
      `/students?include=contacts,classes,year&per_page=200&page=${page}`,
      schoolToken
    );

    const counts = await upsertBatch(db, data as WondeStudent[], schoolId);
    totalStudents += counts.students;
    totalGuardians += counts.guardians;
    totalLinks += counts.links;

    hasMore = !!meta?.pagination?.next;
    page++;
  }

  return { students: totalStudents, guardians: totalGuardians, links: totalLinks };
}

async function upsertBatch(
  db: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  wondeStudents: WondeStudent[],
  schoolId: string
) {
  let students = 0;
  let guardians = 0;
  let links = 0;

  for (const ws of wondeStudents) {
    const { data: student } = await (db as any)
      .from("students")
      .upsert(
        {
          school_id: schoolId,
          first_name: ws.forename,
          year_group: ws.year?.data?.name ?? null,
          class_name: ws.classes?.data?.[0]?.name ?? null,
          wonde_id: ws.id,
        },
        { onConflict: "wonde_id" }
      )
      .select("id")
      .single();

    if (!student) continue;
    students++;

    for (const contact of ws.contacts?.data ?? []) {
      if (!contact.email?.address) continue;
      if (!contact.parental_responsibility) continue;

      const email = contact.email.address.toLowerCase().trim();
      const phone = contact.telephone?.number ?? null;

      const { data: guardian } = await db
        .from("guardians")
        .upsert({ email, phone }, { onConflict: "email" })
        .select("id")
        .single();

      if (!guardian) continue;
      guardians++;

      const { error: linkErr } = await db
        .from("guardian_student")
        .upsert(
          {
            guardian_id: guardian.id,
            student_id: student.id,
            relationship: contact.relationship_to_student ?? "parent",
          },
          { onConflict: "guardian_id,student_id" }
        );

      if (!linkErr) links++;
    }
  }

  return { students, guardians, links };
}
