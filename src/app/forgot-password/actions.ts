"use server";

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "School2Pay <payments@school2pay.example.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function sendPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string).toLowerCase().trim();
  if (!email) redirect("/forgot-password?error=Please+enter+your+email+address");

  const admin = getAdmin();

  // Look up the user — don't reveal whether the account exists
  const { data: { users } } = await admin.auth.admin.listUsers();
  const user = users.find((u) => u.email?.toLowerCase() === email);

  if (user) {
    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store in email_verifications table (reuse existing table)
    await (admin as any).from("password_resets").upsert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
      used_at: null,
    }, { onConflict: "user_id" });

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Reset your School2Pay password",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
          <div style="background:#1d4ed8;padding:24px;color:#fff">
            <h1 style="margin:0;font-size:20px;font-weight:700">Reset your password</h1>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.8">School2Pay</p>
          </div>
          <div style="padding:24px;color:#374151">
            <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;margin:16px 0;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Reset password
            </a>
            <p style="font-size:12px;color:#9ca3af;margin-top:24px">
              If you didn't request this, you can safely ignore this email.<br>
              This link expires in 1 hour and can only be used once.
            </p>
          </div>
        </div>
      `,
    });
  }

  // Always redirect to the same page — don't reveal account existence
  redirect("/forgot-password?sent=1");
}
