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

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.includes("already been registered")
      ? "An account with this email already exists. Try signing in instead."
      : authError.message;
    redirect(`/signup?error=${encodeURIComponent(msg)}`);
  }

  if (!authData?.user) {
    redirect(`/signup?error=${encodeURIComponent("Failed to create account — please try again.")}`);
  }

  const supabase = await createServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    redirect(`/signup?error=${encodeURIComponent("Account created but sign-in failed: " + signInError.message)}`);
  }

  redirect("/onboarding");
}
