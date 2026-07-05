"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error, data } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Check if this is a trust admin — redirect to trust dashboard
  if (data.user) {
    const admin = adminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: trustAdmin } = await (admin.from("trust_admin_users") as any)
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle() as { data: { id: string } | null };

    if (trustAdmin) redirect("/trust/dashboard");
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
