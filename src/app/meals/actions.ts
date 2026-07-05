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

type MenuOption = { id: string; name: string; description: string };

export async function saveMenu(formData: FormData) {
  const schoolId = await getSchoolId();
  const admin = getAdmin();

  const date = formData.get("date") as string;
  const cutoffTime = (formData.get("cutoff_time") as string) || "09:30";
  const optionsRaw = formData.get("options") as string;
  const options: MenuOption[] = JSON.parse(optionsRaw);

  if (!date || !options.length) throw new Error("Date and at least one option required");

  await (admin.from("meal_menus") as any).upsert({
    school_id: schoolId,
    date,
    options,
    cutoff_time: cutoffTime,
    published: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "school_id,date" });

  revalidatePath("/meals");
}

export async function deleteMenu(formData: FormData) {
  await getSchoolId();
  const admin = getAdmin();
  const menuId = formData.get("menu_id") as string;
  await (admin.from("meal_menus") as any).delete().eq("id", menuId);
  revalidatePath("/meals");
}
