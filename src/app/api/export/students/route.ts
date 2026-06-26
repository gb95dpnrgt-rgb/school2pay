import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: students } = await supabase
    .from("students")
    .select(`
      first_name, year_group,
      guardian_student(
        relationship,
        guardians(email, phone)
      )
    `)
    .order("year_group")
    .order("first_name") as {
      data: Array<{
        first_name: string;
        year_group: string;
        guardian_student: Array<{
          relationship: string;
          guardians: { email: string; phone: string | null } | null;
        }>;
      }> | null;
    };

  const headers = [
    "First name",
    "Year group",
    "Guardian email(s)",
    "Guardian phone(s)",
    "Relationship(s)",
  ];

  const rows = (students ?? []).map((s) => {
    const links = s.guardian_student.filter((gs) => gs.guardians);
    return [
      s.first_name,
      s.year_group,
      links.map((gs) => gs.guardians?.email ?? "").join("; "),
      links.map((gs) => gs.guardians?.phone ?? "").filter(Boolean).join("; "),
      links.map((gs) => gs.relationship).join("; "),
    ];
  });

  const csv = buildCsv(headers, rows);
  return csvResponse(csv, "students.csv");
}
