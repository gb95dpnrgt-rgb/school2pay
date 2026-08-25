"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { syncSchoolFromWonde } from "@/lib/wonde";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type WondeSyncResult = {
  studentsCreated: number;
  guardiansCreated: number;
  linksCreated: number;
};

export async function confirmWondeSync(token: string, schoolDbId: string): Promise<WondeSyncResult> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdmin();

  // Save token against school so future syncs and cron can use it
  await (admin.from("schools") as any)
    .update({ wonde_token: token, wonde_last_sync: new Date().toISOString() })
    .eq("id", schoolDbId);

  const counts = await syncSchoolFromWonde(token, schoolDbId);

  revalidatePath("/students");
  return {
    studentsCreated: counts.students,
    guardiansCreated: counts.guardians,
    linksCreated: counts.links,
  };
}
