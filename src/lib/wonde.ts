/**
 * Wonde API client
 * Docs: https://docs.wonde.com
 *
 * Wonde is a middleware that connects to UK school MIS systems
 * (SIMS, Arbor, Bromcom, iSAMS etc.) and provides a unified REST API.
 *
 * Each school has a unique Wonde school ID and grants access via their
 * admin portal. The school ID looks like: A0000000000
 *
 * Base URL:
 *   Sandbox: https://api.wonde.com/v1.0/ (use school ID A0000000000)
 *   Live:    https://api.wonde.com/v1.0/
 */

const WONDE_BASE = "https://api.wonde.com/v1.0";
const SANDBOX_SCHOOL_ID = "A0000000000"; // Wonde's sandbox school

export type WondeStudent = {
  id: string;
  forename: string;
  surname: string; // we don't store this per CLAUDE.md but need it to identify duplicates
  year_group?: { data?: { name?: string } };
  contacts?: {
    data: Array<{
      id: string;
      forename: string;
      surname: string;
      relationship_to_student: string;
      emails?: { data: Array<{ email: string; main: boolean }> };
      phones?: { data: Array<{ phone: string; main: boolean }> };
    }>;
  };
};

export type WondeSyncPreview = {
  students: Array<{
    firstName: string;
    yearGroup: string;
    guardians: Array<{
      email: string;
      phone: string | null;
      relationship: string;
    }>;
  }>;
  totalStudents: number;
  totalGuardians: number;
  schoolName: string;
};

export class WondeClient {
  private token: string;
  private schoolId: string;

  constructor(token: string, schoolId?: string) {
    this.token = token;
    this.schoolId = schoolId ?? SANDBOX_SCHOOL_ID;
  }

  private async fetch<T>(path: string): Promise<T> {
    const url = `${WONDE_BASE}/schools/${this.schoolId}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Wonde API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /** Fetch school info to validate credentials */
  async getSchool(): Promise<{ data: { name: string; urn: string } }> {
    return this.fetch("/");
  }

  /** Fetch all students with year group and contacts, paginated */
  async getAllStudents(): Promise<WondeStudent[]> {
    const students: WondeStudent[] = [];
    let next: string | null =
      `/students?include=year_group,contacts.emails,contacts.phones&per_page=200`;

    while (next) {
      const res = await this.fetch<{
        data: WondeStudent[];
        meta: { pagination: { next: string | null } };
      }>(next);

      students.push(...res.data);
      next = res.meta?.pagination?.next ?? null;
    }

    return students;
  }

  /** Build a preview of what will be imported */
  async buildPreview(): Promise<WondeSyncPreview> {
    const [schoolRes, rawStudents] = await Promise.all([
      this.getSchool(),
      this.getAllStudents(),
    ]);

    const students = rawStudents
      .map((s) => {
        const yearGroup =
          s.year_group?.data?.name ?? "Unknown";

        const guardians = (s.contacts?.data ?? [])
          .map((c) => {
            const email = c.emails?.data?.find((e) => e.main)?.email
              ?? c.emails?.data?.[0]?.email;
            if (!email) return null;
            const phone = c.phones?.data?.find((p) => p.main)?.phone
              ?? c.phones?.data?.[0]?.phone
              ?? null;
            return {
              email,
              phone: phone ?? null,
              relationship: c.relationship_to_student ?? "Parent",
            };
          })
          .filter((g): g is NonNullable<typeof g> => g !== null);

        return {
          firstName: s.forename,
          yearGroup,
          guardians,
        };
      })
      .filter((s) => s.yearGroup !== "Unknown");

    const totalGuardians = new Set(
      students.flatMap((s) => s.guardians.map((g) => g.email))
    ).size;

    return {
      students,
      totalStudents: students.length,
      totalGuardians,
      schoolName: schoolRes.data.name,
    };
  }
}
