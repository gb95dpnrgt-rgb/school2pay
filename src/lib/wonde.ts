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
