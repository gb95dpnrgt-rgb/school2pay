"use server";

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendVerificationEmail } from "@/lib/email";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signup(formData: FormData) {
  const email = (formData.get("email") as string).toLowerCase().trim();
  const password = formData.get("password") as string;

  const admin = getAdminClient();

  // Create user — not yet confirmed
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
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

  // Generate and store verification token (expires in 24 hours)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tokenError } = await (admin as any)
    .from("email_verifications")
    .insert({ user_id: authData.user.id, token, expires_at: expiresAt });

  if (tokenError) {
    console.error("Failed to store verification token:", tokenError);
    redirect(`/signup?error=${encodeURIComponent("Failed to send verification email — please try again.")}`);
  }

  // Send verification email via Resend
  try {
    await sendVerificationEmail({ email, token });
  } catch (e) {
    console.error("Failed to send verification email:", e);
    redirect(`/signup?error=${encodeURIComponent("Failed to send verification email — please try again.")}`);
  }

  redirect("/signup/verify");
}
