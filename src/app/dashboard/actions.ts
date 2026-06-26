"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function inviteAdmin(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised" };

  const email = (formData.get("email") as string ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required" };

  // Get the current admin's school
  const { data: school } = await supabase.from("schools").select("id, name").single();
  if (!school) return { error: "No school found for your account" };

  const admin = getAdmin();

  // Check if this email is already an admin for this school
  const { data: existing } = await admin
    .from("admin_users")
    .select("id")
    .eq("school_id", school.id)
    .eq("email", email)
    .maybeSingle();

  if (existing) return { error: "This email is already an admin for this school" };

  // Send Supabase invite — creates the auth user and emails a magic link
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?type=invite`,
    data: { school_id: school.id },
  });

  if (inviteError || !invited?.user) {
    return { error: inviteError?.message ?? "Failed to send invite" };
  }

  // Pre-create admin_users row so the callback can detect the school link
  const { error: insertError } = await admin.from("admin_users").insert({
    school_id: school.id,
    auth_user_id: invited.user.id,
    email: invited.user.email!,
  });

  if (insertError) {
    // If unique violation the user was already invited — not a hard error
    if (insertError.code !== "23505") {
      return { error: insertError.message };
    }
  }

  return { success: true };
}
