"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendPaymentNotification } from "@/lib/email";
import { checkLedgerBalance } from "@/lib/ledger";
import { stripe } from "@/lib/stripe";
import type { Database } from "@/lib/supabase/types";

const CHASE_COOLDOWN_HOURS = 48;

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface RemindSummary {
  unpaidCount: number;       // number of unpaid/partial assignments
  guardianCount: number;     // unique guardians to be emailed
  recentlyChasedCount: number; // guardians already chased in the last 48 h
  lastChaseAt: string | null;  // ISO timestamp of most recent chase for this request
}

/** Pre-flight: count who will receive a reminder and flag any 48-h cooldown violations. */
export async function getRemindSummary(requestId: string): Promise<RemindSummary> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  // Verify request belongs to admin's school
  const { data: req } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Request not found");

  const admin = getAdmin();

  // All unpaid/partial assignments with guardians
  const { data: assignments } = await admin
    .from("assignments")
    .select(`
      id,
      students!inner(
        guardian_student(guardians(id, email))
      )
    `)
    .eq("payment_request_id", requestId)
    .in("status", ["unpaid", "partial"]) as {
      data: Array<{
        id: string;
        students: {
          guardian_student: Array<{
            guardians: { id: string; email: string } | null;
          }>;
        };
      }> | null;
    };

  const unpaidCount = assignments?.length ?? 0;

  // Collect unique guardian IDs
  const guardianIds = [
    ...new Set(
      (assignments ?? []).flatMap((a) =>
        a.students.guardian_student
          .map((gs) => gs.guardians?.id)
          .filter(Boolean) as string[]
      )
    ),
  ];

  if (guardianIds.length === 0) {
    return { unpaidCount: 0, guardianCount: 0, recentlyChasedCount: 0, lastChaseAt: null };
  }

  const cutoff = new Date(Date.now() - CHASE_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

  const { data: recentLogs } = await admin
    .from("email_log")
    .select("guardian_id, sent_at")
    .eq("payment_request_id", requestId)
    .in("guardian_id", guardianIds)
    .gte("sent_at", cutoff)
    .order("sent_at", { ascending: false });

  const recentGuardianIds = new Set((recentLogs ?? []).map((l) => l.guardian_id));
  const lastChaseAt = recentLogs?.[0]?.sent_at ?? null;

  return {
    unpaidCount,
    guardianCount: guardianIds.length,
    recentlyChasedCount: recentGuardianIds.size,
    lastChaseAt,
  };
}

/** Send reminder emails to all unpaid/partial guardians for this request. */
export async function remindUnpaid(requestId: string): Promise<{ sent: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  // RLS check — request must belong to admin's school
  const { data: req } = await supabase
    .from("payment_requests")
    .select("id, title, due_date, schools(name)")
    .eq("id", requestId)
    .single() as {
      data: {
        id: string; title: string; due_date: string;
        schools: { name: string } | null;
      } | null;
    };
  if (!req) throw new Error("Request not found");

  const admin = getAdmin();
  const schoolName = (req.schools as unknown as { name: string } | null)?.name ?? "Your school";

  // All unpaid/partial assignments with guardian + student data
  const { data: assignments } = await admin
    .from("assignments")
    .select(`
      id, amount_due_pence,
      students!inner(
        first_name, year_group,
        guardian_student(
          guardians(id, email)
        )
      )
    `)
    .eq("payment_request_id", requestId)
    .in("status", ["unpaid", "partial"]) as {
      data: Array<{
        id: string;
        amount_due_pence: number;
        students: {
          first_name: string; year_group: string;
          guardian_student: Array<{
            guardians: { id: string; email: string } | null;
          }>;
        };
      }> | null;
    };

  if (!assignments?.length) return { sent: 0 };

  // Group unpaid children by guardian
  const byGuardian = new Map<string, {
    email: string;
    children: Array<{ firstName: string; yearGroup: string; amountPence: number }>;
  }>();

  for (const asgn of assignments) {
    for (const link of asgn.students.guardian_student) {
      const g = link.guardians;
      if (!g) continue;
      if (!byGuardian.has(g.id)) {
        byGuardian.set(g.id, { email: g.email, children: [] });
      }
      byGuardian.get(g.id)!.children.push({
        firstName: asgn.students.first_name,
        yearGroup: asgn.students.year_group,
        amountPence: asgn.amount_due_pence,
      });
    }
  }

  const logRows: Array<{
    guardian_id: string;
    payment_request_id: string;
    resend_message_id: string | null;
    type: string;
  }> = [];

  for (const [guardianId, { email, children }] of byGuardian) {
    const messageId = await sendPaymentNotification({
      guardianId,
      email,
      paymentRequestId: requestId,
      requestTitle: req.title,
      schoolName,
      dueDate: req.due_date,
      children,
      isReminder: true,
    });
    logRows.push({
      guardian_id: guardianId,
      payment_request_id: requestId,
      resend_message_id: messageId,
      type: "reminder",
    });
  }

  if (logRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("email_log") as any).insert(logRows);
  }

  return { sent: logRows.length };
}

/** Toggle a payment request between open and closed. Closed requests still show in the list but no new payments can be taken. */
export async function setRequestStatus(
  requestId: string,
  newStatus: "open" | "closed"
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  // RLS ensures this admin can only update their own school's requests
  const { error } = await supabase
    .from("payment_requests")
    .update({ status: newStatus })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
}

/** Mark an assignment as waived (free place). Writes audit log. No ledger entry — no money changes hands. */
export async function waivedAssignment(
  assignmentId: string,
  requestId: string,
  note: string | null
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  // RLS — verify request belongs to this admin's school
  const { data: req } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Request not found or access denied");

  const admin = getAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc("waive_assignment", {
    p_assignment_id: assignmentId,
    p_admin_id: user.id,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/requests/${requestId}`);
}

/** Issue a full Stripe refund for a paid assignment. The charge.refunded webhook handles the rest. */
export async function refundAssignment(
  assignmentId: string,
  requestId: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  // RLS — verify request belongs to this admin's school
  const { data: req } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Request not found or access denied");

  const admin = getAdmin();

  // Find the succeeded transaction for this assignment via transaction_lines
  const { data: line } = await admin
    .from("transaction_lines")
    .select("transaction_id, transactions(id, stripe_payment_intent, status)")
    .eq("assignment_id", assignmentId)
    .maybeSingle() as {
      data: {
        transaction_id: string;
        transactions: { id: string; stripe_payment_intent: string; status: string } | null;
      } | null;
    };

  const txn = line?.transactions;
  if (!txn) throw new Error("No payment found for this assignment");
  if (txn.status !== "succeeded") throw new Error("Payment has not succeeded — cannot refund");
  if (!txn.stripe_payment_intent) throw new Error("No Stripe payment intent found");

  // Issue the refund via Stripe — webhook handles ledger + assignment status
  await stripe.refunds.create({ payment_intent: txn.stripe_payment_intent });

  revalidatePath(`/requests/${requestId}`);
}

/** Record a cash/cheque payment against an assignment. Posts balanced ledger entries. */
export async function recordOfflinePayment(
  assignmentId: string,
  requestId: string,
  amountPence: number,
  note: string
): Promise<{ ledgerBalanced: boolean }> {
  if (!Number.isInteger(amountPence) || amountPence <= 0) {
    throw new Error("Amount must be a positive integer number of pence");
  }
  if (!note.trim()) throw new Error("A note is required for offline payments");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");

  const { data: req } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Request not found or access denied");

  const admin = getAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc("record_offline_payment", {
    p_assignment_id: assignmentId,
    p_amount_pence: amountPence,
    p_admin_id: user.id,
    p_note: note.trim(),
  });
  if (error) throw new Error(error.message);

  // Verify ledger integrity after every offline payment
  const result = await checkLedgerBalance(admin);
  if (!result.balanced) {
    console.error("[offline-payment] LEDGER IMBALANCE after posting:", result);
  }

  revalidatePath(`/requests/${requestId}`);
  return { ledgerBalanced: result.balanced };
}
