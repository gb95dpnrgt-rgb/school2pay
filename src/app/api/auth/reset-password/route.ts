import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = getAdmin();

  const { data: record } = await (admin as any)
    .from("password_resets")
    .select("user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!record) return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
  if (record.used_at) return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });
  if (new Date(record.expires_at) < new Date()) return NextResponse.json({ error: "This reset link has expired" }, { status: 400 });

  // Update the password
  const { error: updateErr } = await admin.auth.admin.updateUserById(record.user_id, { password });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Mark token as used
  await (admin as any)
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  return NextResponse.json({ ok: true });
}
