import { createClient as adminClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import MealOrderClient from "./MealOrderClient";

export type MenuOption = { id: string; name: string; description: string };
export type PublicMenu = {
  id: string;
  date: string;
  options: MenuOption[];
  cutoff_time: string;
};
export type PublicStudent = { id: string; first_name: string; year_group: string };

export default async function MealOrderPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: school } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .single();

  if (!school) notFound();

  // Fetch published menus for today and the next 6 days
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);

  const { data: menusRaw } = await (admin.from("meal_menus") as any)
    .select("id, date, options, cutoff_time")
    .eq("school_id", schoolId)
    .eq("published", true)
    .gte("date", today)
    .lte("date", weekEnd)
    .order("date") as { data: PublicMenu[] | null };

  const menus = (menusRaw ?? []).filter((m) => {
    // Filter out menus past their cutoff time for today
    if (m.date !== today) return true;
    const [h, min] = m.cutoff_time.split(":").map(Number);
    const now = new Date();
    return now.getHours() < h || (now.getHours() === h && now.getMinutes() < min);
  });

  const { data: students } = await (admin.from("students") as any)
    .select("id, first_name, year_group")
    .eq("school_id", schoolId)
    .order("year_group")
    .order("first_name") as { data: PublicStudent[] | null };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-gray-900">School2Pay</span>
            <span className="text-gray-400 mx-2">·</span>
            <span className="text-sm text-gray-600">{school.name}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meal ordering</h1>
          <p className="mt-1 text-sm text-gray-500">Order must be placed by 9:30am on the day</p>
        </div>

        {menus.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-sm text-gray-500">No menus available to order from right now.</p>
            <p className="text-xs text-gray-400 mt-1">Check back tomorrow morning before 9:30am.</p>
          </div>
        ) : (
          <MealOrderClient menus={menus} students={students ?? []} schoolId={schoolId} />
        )}
      </div>
    </main>
  );
}
