import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPaymentConfirmation } from "@/lib/email";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const txnId = req.nextUrl.searchParams.get("txnId");
  if (!txnId) return NextResponse.json({ error: "Missing txnId" }, { status: 400 });

  const db = getAdmin();

  const { data: txnRow, error: e1 } = await db.from("transactions").select("guardian_id").eq("id", txnId).single();
  if (!txnRow?.guardian_id) return NextResponse.json({ error: "Transaction not found or no guardian_id", detail: e1 }, { status: 404 });

  const { data: guardian, error: e2 } = await db.from("guardians").select("email").eq("id", txnRow.guardian_id).single();
  if (!guardian?.email) return NextResponse.json({ error: "Guardian not found or no email", detail: e2 }, { status: 404 });

  const { data: lines, error: e3 } = await db.from("transaction_lines").select("id, assignment_id, amount_pence").eq("transaction_id", txnId);
  if (!lines?.length) return NextResponse.json({ error: "No transaction lines", detail: e3 }, { status: 404 });

  const children: Array<{ firstName: string; yearGroup: string; amountPence: number }> = [];
  let requestTitle = "";
  let schoolName = "";

  for (const line of lines) {
    const { data: asgn } = await db.from("assignments").select("payment_request_id, student_id").eq("id", line.assignment_id).single();
    if (!asgn) continue;

    const { data: student } = await db.from("students").select("first_name, year_group").eq("id", asgn.student_id).single();
    if (student) children.push({ firstName: student.first_name, yearGroup: student.year_group, amountPence: line.amount_pence });

    if (!requestTitle && asgn.payment_request_id) {
      const { data: pr } = await db.from("payment_requests").select("title, school_id").eq("id", asgn.payment_request_id).single();
      requestTitle = pr?.title ?? "";
      if (pr?.school_id) {
        const { data: school } = await db.from("schools").select("name").eq("id", pr.school_id).single();
        schoolName = school?.name ?? "";
      }
    }
  }

  if (!children.length || !requestTitle) {
    return NextResponse.json({ error: "Missing data for email", children, requestTitle, schoolName });
  }

  const { data: result, error: resendErr } = await (sendPaymentConfirmation({ email: guardian.email, requestTitle, schoolName, children }) as any).catch((err: any) => ({ data: null, error: err?.message }));

  return NextResponse.json({
    sent: !resendErr,
    resendId: result,
    resendErr,
    email: guardian.email,
    requestTitle,
    schoolName,
    children,
    RESEND_FROM: process.env.RESEND_FROM,
    hasResendKey: !!process.env.RESEND_API_KEY,
  });
}
