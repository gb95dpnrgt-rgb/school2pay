import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import ClubsClient from "./ClubsClient";

export type Club = {
  id: string;
  name: string;
  description: string | null;
  fee_model: "termly" | "weekly";
  fee_pence: number;
  sessions_per_term: number | null;
  day_of_week: string | null;
  start_date: string | null;
  end_date: string | null;
  max_capacity: number | null;
  status: "draft" | "open" | "closed";
  enrolled_count: number;
  waitlisted_count: number;
};

export default async function ClubsPage() {
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

  const { data: clubsRaw } = await (admin.from("clubs") as any)
    .select("id, name, description, fee_model, fee_pence, sessions_per_term, day_of_week, start_date, end_date, max_capacity, status")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false }) as {
      data: Array<Omit<Club, "enrolled_count" | "waitlisted_count">> | null
    };

  // Fetch enrollment counts per club
  const clubIds = (clubsRaw ?? []).map((c) => c.id);
  const { data: enrollments } = clubIds.length
    ? await (admin.from("club_enrollments") as any)
        .select("club_id, status")
        .in("club_id", clubIds)
        .in("status", ["enrolled", "waitlisted"]) as {
          data: Array<{ club_id: string; status: string }> | null
        }
    : { data: [] };

  const countMap = new Map<string, { enrolled: number; waitlisted: number }>();
  for (const e of enrollments ?? []) {
    if (!countMap.has(e.club_id)) countMap.set(e.club_id, { enrolled: 0, waitlisted: 0 });
    const c = countMap.get(e.club_id)!;
    if (e.status === "enrolled") c.enrolled++;
    else if (e.status === "waitlisted") c.waitlisted++;
  }

  const clubs: Club[] = (clubsRaw ?? []).map((c) => ({
    ...c,
    enrolled_count: countMap.get(c.id)?.enrolled ?? 0,
    waitlisted_count: countMap.get(c.id)?.waitlisted ?? 0,
  }));

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/clubs" className="text-sm font-medium text-gray-900">Clubs</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clubs</h1>
            <p className="mt-1 text-sm text-gray-500">{school.name}</p>
          </div>
        </div>

        <ClubsClient clubs={clubs} schoolId={school.id} />
      </div>
    </main>
  );
}
