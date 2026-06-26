"use server";

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notifyGuardians } from "@/lib/notify";
import type { Database } from "@/lib/supabase/types";

function getAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createPaymentRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id").single();
  if (!school) throw new Error("No school found for this user");

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const amountPence = parseInt(formData.get("amount_pence") as string, 10);
  const dueDate = formData.get("due_date") as string;
  const targetValue = formData.get("target") as string;
  const allowPartial = formData.get("allow_partial") === "on";

  if (!title || !amountPence || amountPence <= 0 || !dueDate) {
    throw new Error("Missing required fields");
  }

  const yearGroups = targetValue === "all" ? null : [targetValue];

  const admin = getAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req, error: reqErr } = await (admin.from("payment_requests") as any)
    .insert({
      school_id: school.id,
      title,
      description,
      amount_pence: amountPence,
      due_date: dueDate,
      year_groups: yearGroups,
      allow_partial: allowPartial,
    })
    .select("id")
    .single();

  if (reqErr || !req) throw new Error(reqErr?.message ?? "Failed to create payment request");

  let studentsQuery = admin
    .from("students")
    .select("id")
    .eq("school_id", school.id);

  if (yearGroups) {
    studentsQuery = studentsQuery.in("year_group", yearGroups);
  }

  const { data: students, error: studErr } = await studentsQuery;
  if (studErr) throw new Error(studErr.message);

  if (students && students.length > 0) {
    const assignments = students.map((s) => ({
      payment_request_id: req.id,
      student_id: s.id,
      amount_due_pence: amountPence,
      amount_paid_pence: 0,
      status: "unpaid" as const,
    }));

    const { error: assignErr } = await admin.from("assignments").insert(assignments);
    if (assignErr) throw new Error(assignErr.message);
  }

  // Fire-and-forget: send emails to guardians (do not block redirect on email delivery)
  notifyGuardians(req.id).catch((err) => console.error("Email notification failed:", err));

  redirect("/requests");
}

export async function resendGuardianEmail(guardianId: string, paymentRequestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  // Verify admin owns this payment request
  const { data: req } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("id", paymentRequestId)
    .single();
  if (!req) throw new Error("Payment request not found or access denied");

  const admin = getAdminClient();

  // Re-fetch guardian
  const { data: guardian } = await admin
    .from("guardians")
    .select("id, email")
    .eq("id", guardianId)
    .single();
  if (!guardian) throw new Error("Guardian not found");

  // Fetch their children's assignments for this request
  const { data: assignments } = await admin
    .from("assignments")
    .select("amount_due_pence, students!inner(first_name, year_group, guardian_student!inner(guardian_id))")
    .eq("payment_request_id", paymentRequestId) as {
      data: Array<{
        amount_due_pence: number;
        students: {
          first_name: string; year_group: string;
          guardian_student: Array<{ guardian_id: string }>;
        };
      }> | null;
    };

  const children = (assignments ?? [])
    .filter((a) => a.students.guardian_student.some((gs) => gs.guardian_id === guardianId))
    .map((a) => ({
      firstName: a.students.first_name,
      yearGroup: a.students.year_group,
      amountPence: a.amount_due_pence,
    }));

  if (children.length === 0) throw new Error("No assignments found for this guardian");

  const { data: reqData } = await admin
    .from("payment_requests")
    .select("title, due_date, schools(name)")
    .eq("id", paymentRequestId)
    .single() as { data: { title: string; due_date: string; schools: { name: string } | null } | null };

  const { sendPaymentNotification } = await import("@/lib/email");
  const messageId = await sendPaymentNotification({
    guardianId,
    email: guardian.email,
    paymentRequestId,
    requestTitle: reqData?.title ?? "",
    schoolName: (reqData?.schools as unknown as { name: string } | null)?.name ?? "",
    dueDate: reqData?.due_date ?? "",
    children,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("email_log") as any).insert({
    guardian_id: guardianId,
    payment_request_id: paymentRequestId,
    resend_message_id: messageId,
    type: "reminder",
  });

  return { ok: true };
}
