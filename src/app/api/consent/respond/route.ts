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
    const { token, guardianId, consentFormId, assignmentId, responses, guardianNameSigned } = body;

    if (!token || !guardianId || !consentFormId || !assignmentId || !guardianNameSigned) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify magic token matches this guardian
    const payload = await verifyMagicToken(token);
    if (!payload || payload.guardianId !== guardianId) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    }

    const admin = getAdmin();

    // Verify guardian owns this assignment via guardian_student
    const { data: assignment } = await admin
      .from("assignments")
      .select("id, student_id")
      .eq("id", assignmentId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { data: link } = await admin
      .from("guardian_student")
      .select("guardian_id")
      .eq("guardian_id", guardianId)
      .eq("student_id", assignment.student_id)
      .single();

    if (!link) {
      return NextResponse.json({ error: "Not authorised for this student" }, { status: 403 });
    }

    // Verify consent form belongs to the same payment request as the assignment
    const { data: consentForm } = await (admin.from("consent_forms") as any)
      .select("id, payment_request_id")
      .eq("id", consentFormId)
      .single();

    if (!consentForm) {
      return NextResponse.json({ error: "Consent form not found" }, { status: 404 });
    }

    const { data: asgn } = await admin
      .from("assignments")
      .select("payment_request_id")
      .eq("id", assignmentId)
      .single();

    if (!asgn || asgn.payment_request_id !== consentForm.payment_request_id) {
      return NextResponse.json({ error: "Assignment does not match consent form" }, { status: 400 });
    }

    const signedIp = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;

    // APPEND-ONLY: insert new response (never update existing)
    // GDPR: responses may contain special-category medical/dietary data (Art. 9)
    const { error: insertErr } = await (admin.from("consent_responses") as any).insert({
      consent_form_id: consentFormId,
      assignment_id: assignmentId,
      guardian_id: guardianId,
      responses: responses ?? {},
      guardian_name_signed: guardianNameSigned,
      signed_ip: signedIp,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("consent/respond error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
