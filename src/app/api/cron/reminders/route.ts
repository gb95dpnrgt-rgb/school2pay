import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPaymentNotification } from "@/lib/email";
import { sendSmsReminder, smsEnabled } from "@/lib/sms";
import { signMagicToken } from "@/lib/magic-link";
import type { Database } from "@/lib/supabase/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Days before due date on which we send auto-reminders
const REMINDER_DAYS = [7, 1];

// Don't email a guardian more than once per 48 hours for the same request
const COOLDOWN_HOURS = 48;

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (or our own secret in dev)
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = getAdmin();
  const now = new Date();

  // Build the set of target due dates: today + N days for each N in REMINDER_DAYS
  const targetDates = REMINDER_DAYS.map((n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });

  // Fetch all open requests whose due_date matches one of our target dates
  const { data: requests } = await admin
    .from("payment_requests")
    .select("id, title, due_date, schools(name)")
    .eq("status", "open")
    .in("due_date", targetDates) as {
      data: Array<{
        id: string;
        title: string;
        due_date: string;
        schools: { name: string } | null;
      }> | null;
    };

  if (!requests?.length) {
    console.log("[cron/reminders] no requests due on target dates:", targetDates);
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const cutoff = new Date(now.getTime() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

  let totalSent = 0;
  let totalSkipped = 0;

  for (const req of requests) {
    const schoolName = (req.schools as unknown as { name: string } | null)?.name ?? "Your school";

    // Fetch unpaid/partial assignments with guardian + student data
    const { data: assignments } = await admin
      .from("assignments")
      .select(`
        id, amount_due_pence,
        students!inner(
          first_name, year_group,
          guardian_student(guardians(id, email, phone))
        )
      `)
      .eq("payment_request_id", req.id)
      .in("status", ["unpaid", "partial"]) as {
        data: Array<{
          id: string;
          amount_due_pence: number;
          students: {
            first_name: string;
            year_group: string;
            guardian_student: Array<{
              guardians: { id: string; email: string; phone: string | null } | null;
            }>;
          };
        }> | null;
      };

    if (!assignments?.length) continue;

    // Group children by guardian
    const byGuardian = new Map<string, {
      email: string;
      phone: string | null;
      children: Array<{ firstName: string; yearGroup: string; amountPence: number }>;
    }>();

    for (const asgn of assignments) {
      for (const link of asgn.students.guardian_student) {
        const g = link.guardians;
        if (!g) continue;
        if (!byGuardian.has(g.id)) {
          byGuardian.set(g.id, { email: g.email, phone: g.phone, children: [] });
        }
        byGuardian.get(g.id)!.children.push({
          firstName: asgn.students.first_name,
          yearGroup: asgn.students.year_group,
          amountPence: asgn.amount_due_pence,
        });
      }
    }

    if (byGuardian.size === 0) continue;

    // Check cooldown: which guardians were already emailed within 48h for this request?
    const guardianIds = [...byGuardian.keys()];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentLogs } = await (admin.from("email_log") as any)
      .select("guardian_id")
      .eq("payment_request_id", req.id)
      .in("guardian_id", guardianIds)
      .gte("sent_at", cutoff) as { data: Array<{ guardian_id: string }> | null };

    const recentlyEmailed = new Set((recentLogs ?? []).map((l) => l.guardian_id));

    const logRows: Array<{
      guardian_id: string;
      payment_request_id: string;
      resend_message_id: string | null;
      type: string;
    }> = [];

    for (const [guardianId, { email, phone, children }] of byGuardian) {
      if (recentlyEmailed.has(guardianId)) {
        totalSkipped++;
        continue;
      }

      const messageId = await sendPaymentNotification({
        guardianId,
        email,
        paymentRequestId: req.id,
        requestTitle: req.title,
        schoolName,
        dueDate: req.due_date,
        children,
        isReminder: true,
      });

      // SMS reminder if Twilio configured and guardian has a phone number
      if (smsEnabled() && phone) {
        const token = await signMagicToken(guardianId, req.id);
        const totalPence = children.reduce((s, c) => s + c.amountPence, 0);
        await sendSmsReminder({
          to: phone,
          schoolName,
          requestTitle: req.title,
          amountPence: totalPence,
          payUrl: `${APP_URL}/pay/${encodeURIComponent(token)}`,
        });
      }

      logRows.push({
        guardian_id: guardianId,
        payment_request_id: req.id,
        resend_message_id: messageId,
        type: "reminder",
      });

      totalSent++;
    }

    if (logRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("email_log") as any).insert(logRows);
    }
  }

  console.log(`[cron/reminders] done — sent=${totalSent}, skipped=${totalSkipped}`);
  return NextResponse.json({ sent: totalSent, skipped: totalSkipped });
}
