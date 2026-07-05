import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ShopBrowseClient from "./ShopBrowseClient";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function ShopBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const { schoolId } = await params;
  const { success } = await searchParams;
  const admin = getAdmin();

  const { data: school } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .single() as { data: { id: string; name: string } | null };

  if (!school) notFound();

  const { data: items } = await (admin.from("shop_items") as any)
    .select("id, name, description, price_pence, stock")
    .eq("school_id", schoolId)
    .eq("active", true)
    .order("sort_order")
    .order("created_at") as { data: Array<{ id: string; name: string; description: string | null; price_pence: number; stock: number | null }> | null };

  const { data: students } = await admin
    .from("students")
    .select("id, first_name, year_group")
    .eq("school_id", schoolId)
    .order("year_group")
    .order("first_name") as { data: Array<{ id: string; first_name: string; year_group: string }> | null };

  return (
    <ShopBrowseClient
      school={school}
      items={items ?? []}
      students={students ?? []}
      justOrdered={success === "1"}
    />
  );
}
