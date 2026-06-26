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

export async function createSchool(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const legalName = (formData.get("legal_name") as string).trim();
  const schoolName = (formData.get("school_name") as string).trim();
  const urn = (formData.get("urn") as string).trim() || null;

  const admin = getAdminClient();

  const { data: trust, error: trustError } = await admin
    .from("trusts")
    .insert({ legal_name: legalName })
    .select("id")
    .single();

  if (trustError || !trust) {
    redirect(`/onboarding?error=${encodeURIComponent("Failed to create trust")}`);
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ trust_id: trust.id, name: schoolName, urn })
    .select("id")
    .single();

  if (schoolError || !school) {
    redirect(`/onboarding?error=${encodeURIComponent("Failed to create school")}`);
  }

  const { error: adminUserError } = await admin
    .from("admin_users")
    .insert({ school_id: school.id, auth_user_id: user.id, email: user.email! });

  if (adminUserError) {
    redirect(`/onboarding?error=${encodeURIComponent("Failed to link admin to school")}`);
  }

  redirect("/onboarding");
}
