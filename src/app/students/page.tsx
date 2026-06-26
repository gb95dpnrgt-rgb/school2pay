import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import ImportClient from "./ImportClient";
import StudentListClient from "./StudentListClient";
import RolloverButton from "./RolloverButton";

type Guardian = { id: string; email: string; phone: string | null };
type GuardianLink = { relationship: string; guardians: Guardian | Guardian[] | null };

export type StudentWithGuardians = {
  id: string;
  first_name: string;
  year_group: string;
  guardian_student: GuardianLink[];
};

export default async function StudentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase
    .from("schools")
    .select("id, name")
    .single();

  const { data: students } = await supabase
    .from("students")
    .select(`
      id,
      first_name,
      year_group,
      guardian_student (
        relationship,
        guardians ( id, email, phone )
      )
    `)
    .order("year_group")
    .order("first_name") as { data: StudentWithGuardians[] | null };

  const yearGroups = [...new Set((students ?? []).map((s) => s.year_group))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/students" className="text-sm font-medium text-gray-900">Students</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="mt-1 text-sm text-gray-500">{school?.name}</p>
        </div>

        {/* Import section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Import from CSV</h2>
          <ImportClient />
        </section>

        {/* Student list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              All students ({students?.length ?? 0})
            </h2>
            <div className="flex items-center gap-2">
              {yearGroups.length > 0 && <RolloverButton yearGroups={yearGroups} />}
              <a
                href="/api/export/students"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                ↓ Export CSV
              </a>
            </div>
          </div>
          <StudentListClient students={students ?? []} />
        </section>
      </div>
    </main>
  );
}
