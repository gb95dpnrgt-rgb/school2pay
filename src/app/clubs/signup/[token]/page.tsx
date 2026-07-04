import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { verifyClubToken } from "@/lib/club-token";
import ClubSignUpClient from "./ClubSignUpClient";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function ClubSignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const { token } = await params;
  const { success } = await searchParams;

  let clubId: string;
  let schoolId: string;
  try {
    const payload = await verifyClubToken(decodeURIComponent(token));
    clubId = payload.clubId;
    schoolId = payload.schoolId;
  } catch {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full text-center space-y-3">
          <p className="text-2xl">🔗</p>
          <h1 className="text-lg font-bold text-gray-900">Link expired</h1>
          <p className="text-sm text-gray-500">This sign-up link has expired. Please contact your school for a new one.</p>
        </div>
      </main>
    );
  }

  const admin = getAdmin();

  const { data: club } = await (admin.from("clubs") as any)
    .select("id, name, description, fee_model, fee_pence, sessions_per_term, day_of_week, start_date, end_date, max_capacity, status, schools(name)")
    .eq("id", clubId)
    .single() as {
      data: {
        id: string; name: string; description: string | null;
        fee_model: string; fee_pence: number; sessions_per_term: number | null;
        day_of_week: string | null; start_date: string | null; end_date: string | null;
        max_capacity: number | null; status: string;
        schools: { name: string } | null;
      } | null
    };

  if (!club) notFound();

  if (club.status === "closed") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center space-y-3">
          <p className="text-2xl">🔒</p>
          <h1 className="text-lg font-bold text-gray-900">{club.name}</h1>
          <p className="text-sm text-gray-500">Sign-ups for this club are currently closed.</p>
        </div>
      </main>
    );
  }

  // Enrolled count
  const { count: enrolledCount } = await (admin.from("club_enrollments") as any)
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("status", "enrolled") as { count: number | null };

  const isFull = club.max_capacity !== null && (enrolledCount ?? 0) >= club.max_capacity;

  // Students at this school (for the dropdown)
  const { data: students } = await admin
    .from("students")
    .select("id, first_name, year_group")
    .eq("school_id", schoolId)
    .order("year_group")
    .order("first_name") as { data: Array<{ id: string; first_name: string; year_group: string }> | null };

  const totalFee = club.fee_model === "weekly"
    ? club.fee_pence * (club.sessions_per_term ?? 1)
    : club.fee_pence;

  return (
    <ClubSignUpClient
      token={token}
      club={{ ...club, schoolName: (club.schools as any)?.name ?? "" }}
      students={students ?? []}
      isFull={isFull}
      totalFeePence={totalFee}
      justSignedUp={success === "1"}
    />
  );
}
