"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getSchoolId() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: school } = await supabase.from("schools").select("id").single();
  if (!school) throw new Error("No school found");
  return school.id;
}

export async function createShopItem(formData: FormData) {
  const schoolId = await getSchoolId();
  const admin = getAdmin();

  const price = Math.round(parseFloat(formData.get("price") as string) * 100);
  const stock = formData.get("stock") ? parseInt(formData.get("stock") as string, 10) : null;

  await (admin.from("shop_items") as any).insert({
    school_id: schoolId,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    price_pence: price,
    stock,
    active: true,
  });

  revalidatePath("/shop");
}

export async function toggleShopItem(formData: FormData) {
  await getSchoolId();
  const admin = getAdmin();
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  await (admin.from("shop_items") as any)
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/shop");
}

export async function fulfillOrder(formData: FormData) {
  await getSchoolId();
  const admin = getAdmin();
  const orderId = formData.get("order_id") as string;

  await (admin.from("shop_orders") as any)
    .update({ status: "fulfilled", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  revalidatePath("/shop");
}
