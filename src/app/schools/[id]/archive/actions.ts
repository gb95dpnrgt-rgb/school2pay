"use server";

import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function getAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function archiveSchool(schoolId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify this admin is linked to this school
  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("school_id")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!adminUser) redirect("/dashboard");

  const admin = getAdminClient();
  await admin
    .from("schools")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", schoolId);

  redirect("/dashboard");
}
