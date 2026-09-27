// Wonde MIS integration client
// Docs: https://docs.wonde.com/docs/api/

const WONDE_BASE = "https://api.wonde.com/v1.0";

export interface WondeStudent {
  id: string;           // Wonde student ID
  forename: string;
  mis_id: string;
  year?: { code?: string; name?: string } | null;
  contacts?: { data: WondeContact[] };
}

export interface WondeContact {
  id: string;
  forename: string;
  relationship_to_student: string;
  emails?: { data: Array<{ address: string }> };
  phones?: { data: Array<{ phone: string; type: string }> };
}

export interface WondeSchool {
  id: string;
  name: string;
  urn: string;
  la_code?: string;
}

// Fetch all students for a school (handles pagination automatically)
export async function fetchWondeStudents(
  wondeSchoolId: string,
  token: string
): Promise<WondeStudent[]> {
  const students: WondeStudent[] = [];
  let url: string | null =
    `${WONDE_BASE}/schools/${wondeSchoolId}/students?include=contacts,year&per_page=200`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wonde API error ${res.status}: ${text}`);
    }
    const json: { data: WondeStudent[]; meta?: { pagination?: { next?: string | null } } } =
      await res.json();
    students.push(...(json.data ?? []));
    url = json.meta?.pagination?.next ?? null;
  }

  return students;
}

// Exchange OAuth code for a per-school token
export async function exchangeWondeCode(code: string): Promise<{
  access_token: string;
  school_id: string;
}> {
  const res = await fetch("https://api.wonde.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.WONDE_CLIENT_ID,
      client_secret: process.env.WONDE_CLIENT_SECRET,
      redirect_uri: `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/api/wonde/callback`,
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wonde token exchange failed ${res.status}: ${text}`);
  }
  return res.json();
}

// Build the OAuth authorisation URL to redirect the school admin to
export function wondeAuthoriseUrl(state: string): string {
  const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    client_id: process.env.WONDE_CLIENT_ID ?? "",
    redirect_uri: `${base}/api/wonde/callback`,
    response_type: "code",
    state,
    // Request read access to students and contacts
    scope: "read:students read:contacts read:classes",
  });
  return `https://edu.wonde.com/oauth/authorize?${params.toString()}`;
}

// Map a Wonde year code to a display string
export function wondeYearGroup(student: WondeStudent): string {
  const code = student.year?.code ?? student.year?.name ?? "";
  return code || "Unknown";
}

export interface SyncCounts {
  students: number;
  guardians: number;
  links: number;
}

/**
 * Syncs all students and guardian contacts from Wonde into Supabase for a given school.
 * Idempotent — safe to call repeatedly (upserts by wonde_id).
 */
export async function syncSchoolFromWonde(
  wondeToken: string,
  schoolId: string
): Promise<SyncCounts> {
  // Import admin client lazily to avoid bundling server-only deps in client builds
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch wonde_school_id for this school
  const { data: school } = await (admin as any)
    .from("schools")
    .select("wonde_school_id")
    .eq("id", schoolId)
    .single() as { data: { wonde_school_id: string | null } | null };

  if (!school?.wonde_school_id) throw new Error("School has no wonde_school_id");

  const wondeStudents = await fetchWondeStudents(school.wonde_school_id, wondeToken);

  let studentsCount = 0;
  let guardiansCount = 0;
  let linksCount = 0;

  for (const ws of wondeStudents) {
    const yearGroup = wondeYearGroup(ws);

    const { data: existing } = await (admin as any)
      .from("students")
      .select("id")
      .eq("wonde_id", ws.id)
      .eq("school_id", schoolId)
      .maybeSingle() as { data: { id: string } | null };

    let studentId: string;
    if (existing) {
      await (admin as any)
        .from("students")
        .update({ first_name: ws.forename, year_group: yearGroup })
        .eq("id", existing.id);
      studentId = existing.id;
    } else {
      const { data: newStudent } = await (admin as any)
        .from("students")
        .insert({ school_id: schoolId, first_name: ws.forename, year_group: yearGroup, wonde_id: ws.id })
        .select("id")
        .single() as { data: { id: string } | null };
      if (!newStudent) continue;
      studentId = newStudent.id;
      studentsCount++;
    }

    for (const contact of ws.contacts?.data ?? []) {
      const email = contact.emails?.data?.[0]?.address ?? null;
      const phone = contact.phones?.data?.find((p) => p.type === "mobile")?.phone
        ?? contact.phones?.data?.[0]?.phone
        ?? null;
      if (!email) continue;

      let guardianId: string;
      const { data: existingG } = await (admin as any)
        .from("guardians")
        .select("id")
        .eq("wonde_id", contact.id)
        .maybeSingle() as { data: { id: string } | null };

      if (existingG) {
        await (admin as any).from("guardians").update({ email, phone }).eq("id", existingG.id);
        guardianId = existingG.id;
      } else {
        const { data: byEmail } = await (admin as any)
          .from("guardians").select("id").eq("email", email).maybeSingle() as { data: { id: string } | null };
        if (byEmail) {
          await (admin as any).from("guardians").update({ wonde_id: contact.id, phone: phone ?? undefined }).eq("id", byEmail.id);
          guardianId = byEmail.id;
        } else {
          const { data: newG } = await (admin as any)
            .from("guardians")
            .insert({ email, phone, wonde_id: contact.id })
            .select("id")
            .single() as { data: { id: string } | null };
          if (!newG) continue;
          guardianId = newG.id;
          guardiansCount++;
        }
      }

      await (admin as any)
        .from("guardian_student")
        .upsert(
          { guardian_id: guardianId, student_id: studentId, relationship: contact.relationship_to_student ?? "parent" },
          { onConflict: "guardian_id,student_id", ignoreDuplicates: true }
        );
      linksCount++;
    }
  }

  await (admin as any)
    .from("schools")
    .update({ wonde_synced_at: new Date().toISOString() })
    .eq("id", schoolId);

  return { students: studentsCount, guardians: guardiansCount, links: linksCount };
}
