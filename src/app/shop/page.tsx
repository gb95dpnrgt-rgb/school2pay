import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import ShopClient from "./ShopClient";

export type ShopItem = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  stock: number | null;
  active: boolean;
  sort_order: number;
};

export type ShopOrder = {
  id: string;
  status: string;
  total_pence: number;
  created_at: string;
  note: string | null;
  student: { first_name: string; year_group: string } | null;
  guardian: { email: string };
  lines: Array<{ quantity: number; unit_price_pence: number; item: { name: string } }>;
};

export default async function ShopPage() {
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

  const [{ data: itemsRaw }, { data: ordersRaw }] = await Promise.all([
    (admin.from("shop_items") as any)
      .select("id, name, description, price_pence, stock, active, sort_order")
      .eq("school_id", school.id)
      .order("sort_order")
      .order("created_at") as Promise<{ data: ShopItem[] | null }>,
    (admin.from("shop_orders") as any)
      .select("id, status, total_pence, created_at, note, student_id, guardian_id")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(50) as Promise<{ data: Array<{ id: string; status: string; total_pence: number; created_at: string; note: string | null; student_id: string | null; guardian_id: string }> | null }>,
  ]);

  // Fetch related data for orders
  const guardianIds = [...new Set((ordersRaw ?? []).map((o) => o.guardian_id))];
  const studentIds = [...new Set((ordersRaw ?? []).filter((o) => o.student_id).map((o) => o.student_id!))];
  const orderIds = (ordersRaw ?? []).map((o) => o.id);

  const [{ data: guardians }, { data: students }, { data: lines }] = await Promise.all([
    guardianIds.length ? admin.from("guardians").select("id, email").in("id", guardianIds) : { data: [] },
    studentIds.length ? admin.from("students").select("id, first_name, year_group").in("id", studentIds) : { data: [] },
    orderIds.length
      ? (admin.from("shop_order_lines") as any)
          .select("order_id, quantity, unit_price_pence, item_id, shop_items(name)")
          .in("order_id", orderIds) as Promise<{ data: Array<{ order_id: string; quantity: number; unit_price_pence: number; item_id: string; shop_items: { name: string } | null }> | null }>
      : { data: [] },
  ]);

  const guardianMap = new Map((guardians ?? []).map((g) => [g.id, g]));
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  const linesByOrder = new Map<string, ShopOrder["lines"]>();
  for (const line of lines ?? []) {
    if (!linesByOrder.has(line.order_id)) linesByOrder.set(line.order_id, []);
    linesByOrder.get(line.order_id)!.push({
      quantity: line.quantity,
      unit_price_pence: line.unit_price_pence,
      item: { name: (line.shop_items as any)?.name ?? "Unknown" },
    });
  }

  const orders: ShopOrder[] = (ordersRaw ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    total_pence: o.total_pence,
    created_at: o.created_at,
    note: o.note,
    student: o.student_id ? studentMap.get(o.student_id) ?? null : null,
    guardian: guardianMap.get(o.guardian_id) ?? { email: "Unknown" },
    lines: linesByOrder.get(o.id) ?? [],
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/shop" className="text-sm font-medium text-gray-900">Shop</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Shop</h1>
          <p className="mt-1 text-sm text-gray-500">{school.name}</p>
        </div>
        <ShopClient items={itemsRaw ?? []} orders={orders} schoolId={school.id} />
      </div>
    </main>
  );
}
