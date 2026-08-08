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

export async function addSchool(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolName = (formData.get("school_name") as string).trim();
  const urn = (formData.get("urn") as string | null)?.trim() || null;
  const trustMode = formData.get("trust_mode") as string;

  const admin = getAdminClient();

  let trustId: string;

  if (trustMode === "existing") {
    // Use the admin's existing trust
    const { data: existing } = await supabase
      .from("schools")
      .select("trust_id")
      .limit(1)
      .single();

    if (!existing?.trust_id) {
      redirect(`/schools/new?error=${encodeURIComponent("Could not find existing trust")}`);
    }
    trustId = existing.trust_id;
  } else {
    // Create a new trust
    const legalName = (formData.get("legal_name") as string).trim();
    const { data: trust, error: trustError } = await admin
      .from("trusts")
      .insert({ legal_name: legalName })
      .select("id")
      .single();

    if (trustError || !trust) {
      redirect(`/schools/new?error=${encodeURIComponent("Failed to create trust")}`);
    }
    trustId = trust.id;
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ trust_id: trustId, name: schoolName, urn })
    .select("id")
    .single();

  if (schoolError || !school) {
    redirect(`/schools/new?error=${encodeURIComponent("Failed to create school")}`);
  }

  await admin
    .from("admin_users")
    .insert({ school_id: school.id, auth_user_id: user.id, email: user.email! });

  redirect(`/dashboard?school=${school.id}`);
}
