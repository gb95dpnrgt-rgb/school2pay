/**
 * Fans out payment notification emails to all guardians affected by a payment request.
 * Called after fan-out assignments are created.
 * Uses service-role client so it can read across tables without RLS.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { sendPaymentNotification } from "./email";

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function notifyGuardians(paymentRequestId: string): Promise<void> {
  const admin = getAdmin();

  // Fetch request + school info
  const { data: req } = await admin
    .from("payment_requests")
    .select("id, title, due_date, amount_pence, school_id, schools(name)")
    .eq("id", paymentRequestId)
    .single() as {
      data: {
        id: string; title: string; due_date: string; amount_pence: number;
        school_id: string; schools: { name: string } | null;
      } | null;
    };

  if (!req) return;

  // Fetch all assignments → students → guardian_student → guardians
  const { data: assignments } = await admin
    .from("assignments")
    .select(`
      id, amount_due_pence, student_id,
      students!inner(id, first_name, year_group,
        guardian_student(
          relationship,
          guardians(id, email)
        )
      )
    `)
    .eq("payment_request_id", paymentRequestId) as {
      data: Array<{
        id: string;
        amount_due_pence: number;
        student_id: string;
        students: {
          id: string; first_name: string; year_group: string;
          guardian_student: Array<{
            relationship: string;
            guardians: { id: string; email: string } | null;
          }>;
        };
      }> | null;
    };

  if (!assignments?.length) return;

  // Group by guardian: guardianId → { email, children[] }
  const byGuardian = new Map<string, {
    email: string;
    children: Array<{ firstName: string; yearGroup: string; amountPence: number }>;
  }>();

  for (const asgn of assignments) {
    const student = asgn.students;
    for (const link of student.guardian_student) {
      const g = link.guardians;
      if (!g) continue;
      if (!byGuardian.has(g.id)) {
        byGuardian.set(g.id, { email: g.email, children: [] });
      }
      byGuardian.get(g.id)!.children.push({
        firstName: student.first_name,
        yearGroup: student.year_group,
        amountPence: asgn.amount_due_pence,
      });
    }
  }

  const schoolName = (req.schools as unknown as { name: string } | null)?.name ?? "Your school";

  // Send one email per guardian and log it
  const emailLogRows: Array<{
    guardian_id: string;
    payment_request_id: string;
    resend_message_id: string | null;
    type: string;
  }> = [];

  for (const [guardianId, { email, children }] of byGuardian) {
    const messageId = await sendPaymentNotification({
      guardianId,
      email,
      paymentRequestId,
      requestTitle: req.title,
      schoolName,
      dueDate: req.due_date,
      children,
    });

    emailLogRows.push({ guardian_id: guardianId, payment_request_id: paymentRequestId, resend_message_id: messageId, type: "initial" });
  }

  if (emailLogRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("email_log") as any).insert(emailLogRows);
  }
}
