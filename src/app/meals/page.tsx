import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import MealsClient from "./MealsClient";

export type MenuOption = { id: string; name: string; description: string };

export type MealMenu = {
  id: string;
  date: string;
  options: MenuOption[];
  cutoff_time: string;
  published: boolean;
  orders: Array<{
    id: string;
    option_id: string;
    option_name: string;
    student: { first_name: string; year_group: string };
  }>;
};

export default async function MealsPage() {
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

  // Fetch 4 weeks back and 8 weeks forward for week-navigation support
  const rangeStart = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
  const rangeEnd = new Date(Date.now() + 56 * 86400000).toISOString().slice(0, 10);

  const { data: menusRaw } = await (admin.from("meal_menus") as any)
    .select("id, date, options, cutoff_time, published")
    .eq("school_id", school.id)
    .gte("date", rangeStart)
    .lte("date", rangeEnd)
    .order("date") as {
      data: Array<{ id: string; date: string; options: MenuOption[]; cutoff_time: string; published: boolean }> | null
    };

  // Get orders for these menus
  const menuIds = (menusRaw ?? []).map((m) => m.id);
  const { data: ordersRaw } = menuIds.length
    ? await (admin.from("meal_orders") as any)
        .select("id, menu_id, option_id, option_name, student_id")
        .in("menu_id", menuIds) as {
          data: Array<{ id: string; menu_id: string; option_id: string; option_name: string; student_id: string }> | null
        }
    : { data: [] };

  // Fetch students
  const studentIds = [...new Set((ordersRaw ?? []).map((o) => o.student_id))];
  const { data: students } = studentIds.length
    ? await admin.from("students").select("id, first_name, year_group").in("id", studentIds) as { data: Array<{ id: string; first_name: string; year_group: string }> | null }
    : { data: [] };

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  const ordersByMenu = new Map<string, MealMenu["orders"]>();
  for (const o of ordersRaw ?? []) {
    if (!ordersByMenu.has(o.menu_id)) ordersByMenu.set(o.menu_id, []);
    ordersByMenu.get(o.menu_id)!.push({
      id: o.id,
      option_id: o.option_id,
      option_name: o.option_name,
      student: studentMap.get(o.student_id) ?? { first_name: "Unknown", year_group: "" },
    });
  }

  const menus: MealMenu[] = (menusRaw ?? []).map((m) => ({
    ...m,
    orders: ordersByMenu.get(m.id) ?? [],
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/meals" className="text-sm font-medium text-gray-900">Meal Orders</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meal Pre-ordering</h1>
          <p className="mt-1 text-sm text-gray-500">{school.name} · Parents order by 9:30am each day</p>
        </div>
        <MealsClient menus={menus} schoolId={school.id} />
      </div>
    </main>
  );
}
