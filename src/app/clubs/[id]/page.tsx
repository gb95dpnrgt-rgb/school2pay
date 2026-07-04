import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import ClubDetailClient from "./ClubDetailClient";

export type Enrollment = {
  id: string;
  status: string;
  payment_status: string;
  waitlist_position: number | null;
  created_at: string;
  student: { first_name: string; year_group: string };
  guardian: { email: string; phone: string | null };
};

export default async function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();
  if (!school) redirect("/login");

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: club } = await (admin.from("clubs") as any)
    .select("id, name, fee_model, fee_pence, sessions_per_term, max_capacity, status, day_of_week, start_date, end_date")
    .eq("id", id)
    .eq("school_id", school.id)
    .single() as { data: {
      id: string; name: string; fee_model: string; fee_pence: number;
      sessions_per_term: number | null; max_capacity: number | null;
      status: string; day_of_week: string | null; start_date: string | null; end_date: string | null;
    } | null };

  if (!club) notFound();

  const { data: rawEnrollments } = await (admin.from("club_enrollments") as any)
    .select("id, status, payment_status, waitlist_position, created_at, student_id, guardian_id")
    .eq("club_id", id)
    .order("created_at", { ascending: true }) as {
      data: Array<{ id: string; status: string; payment_status: string; waitlist_position: number | null; created_at: string; student_id: string; guardian_id: string }> | null
    };

  // Fetch students + guardians
  const studentIds = [...new Set((rawEnrollments ?? []).map((e) => e.student_id))];
  const guardianIds = [...new Set((rawEnrollments ?? []).map((e) => e.guardian_id))];

  const [{ data: students }, { data: guardians }] = await Promise.all([
    studentIds.length
      ? admin.from("students").select("id, first_name, year_group").in("id", studentIds)
      : { data: [] },
    guardianIds.length
      ? admin.from("guardians").select("id, email, phone").in("id", guardianIds)
      : { data: [] },
  ]);

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  const guardianMap = new Map((guardians ?? []).map((g) => [g.id, g]));

  const enrollments: Enrollment[] = (rawEnrollments ?? []).map((e) => ({
    id: e.id,
    status: e.status,
    payment_status: e.payment_status,
    waitlist_position: e.waitlist_position,
    created_at: e.created_at,
    student: studentMap.get(e.student_id) ?? { first_name: "Unknown", year_group: "" },
    guardian: guardianMap.get(e.guardian_id) ?? { email: "Unknown", phone: null },
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/clubs" className="text-sm text-gray-500 hover:text-gray-800">Clubs</a>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-900">{club.name}</span>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <ClubDetailClient club={club} enrollments={enrollments} schoolId={school.id} />
      </div>
    </main>
  );
}
