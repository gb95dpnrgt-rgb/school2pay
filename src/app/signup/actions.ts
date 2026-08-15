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

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const admin = getAdminClient();

  // Check if email already exists
  const { data: existing } = await admin.auth.admin.listUsers();
  const emailTaken = existing?.users?.some((u) => u.email === email.toLowerCase().trim());
  if (emailTaken) {
    redirect(`/signup?error=${encodeURIComponent("An account with this email already exists. Try signing in instead.")}`);
  }

  const supabase = await createServerClient();

  const { error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
    },
  });

  if (authError) {
    redirect(`/signup?error=${encodeURIComponent(authError.message ?? "Failed to create account")}`);
  }

  redirect("/signup/verify");
}
