import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyMagicToken } from "@/lib/magic-link";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, guardianId, consentResponseId, reason } = body;

    if (!token || !guardianId || !consentResponseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payload = await verifyMagicToken(token);
    if (!payload || payload.guardianId !== guardianId) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    }

    const admin = getAdmin();

    // Verify this response belongs to this guardian
    const { data: existing } = await (admin.from("consent_responses") as any)
      .select("id, guardian_id, withdrawn_at")
      .eq("id", consentResponseId)
      .single();

    if (!existing || existing.guardian_id !== guardianId) {
      return NextResponse.json({ error: "Not found or not authorised" }, { status: 403 });
    }

    if (existing.withdrawn_at) {
      return NextResponse.json({ error: "Already withdrawn" }, { status: 409 });
    }

    // APPEND-ONLY: set withdrawn_at only — never delete the row
    const { error: updateErr } = await (admin.from("consent_responses") as any)
      .update({ withdrawn_at: new Date().toISOString(), withdrawn_reason: reason ?? null })
      .eq("id", consentResponseId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("consent/withdraw error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
