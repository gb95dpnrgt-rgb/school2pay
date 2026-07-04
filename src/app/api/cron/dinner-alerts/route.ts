import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get all schools with dinner enabled
  const { data: schools } = await (admin.from("dinner_settings") as any)
    .select("school_id, price_per_meal_pence, low_balance_threshold_pence, schools(name)") as {
      data: Array<{
        school_id: string;
        low_balance_threshold_pence: number;
        schools: { name: string } | null;
      }> | null
    };

  let alertsSent = 0;

  for (const school of schools ?? []) {
    const threshold = school.low_balance_threshold_pence;

    // Find wallets below threshold for this school
    const { data: wallets } = await (admin.from("dinner_wallets") as any)
      .select("id, balance_pence, guardian_id")
      .eq("school_id", school.school_id)
      .lt("balance_pence", threshold) as {
        data: Array<{ id: string; balance_pence: number; guardian_id: string }> | null
      };

    if (!wallets?.length) continue;

    const guardianIds = wallets.map((w) => w.guardian_id);
    const { data: guardians } = await admin
      .from("guardians")
      .select("id, email")
      .in("id", guardianIds) as { data: Array<{ id: string; email: string }> | null };

    const guardianMap = new Map((guardians ?? []).map((g) => [g.id, g]));
    const schoolName = (school.schools as any)?.name ?? "your school";

    for (const wallet of wallets) {
      const guardian = guardianMap.get(wallet.guardian_id);
      if (!guardian?.email) continue;

      const balancePounds = (wallet.balance_pence / 100).toFixed(2);
      const isNegative = wallet.balance_pence < 0;

      await resend.emails.send({
        from: "School2Pay <noreply@school2pay.com>",
        to: guardian.email,
        subject: `${isNegative ? "Urgent: " : ""}Dinner money balance ${isNegative ? "is negative" : "running low"} — ${schoolName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#111827;margin-bottom:8px">Dinner money ${isNegative ? "balance overdrawn" : "running low"}</h2>
            <p style="color:#6b7280;margin-bottom:16px">
              Your dinner money wallet at <strong>${schoolName}</strong> has a balance of
              <strong style="color:${isNegative ? "#dc2626" : "#d97706"}">£${balancePounds}</strong>.
            </p>
            ${isNegative
              ? `<p style="color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px">
                  Your account is overdrawn. Please top up as soon as possible to avoid any interruption to your child's meals.
                </p>`
              : `<p style="color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:16px">
                  Please top up soon to ensure your child can continue to have school meals.
                </p>`
            }
            <p style="color:#6b7280;font-size:14px">You can top up via your parent portal link. Contact ${schoolName} if you need a new link.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
            <p style="color:#9ca3af;font-size:12px">School2Pay · school2pay.com</p>
          </div>
        `,
      });

      alertsSent++;
    }
  }

  return NextResponse.json({ ok: true, alertsSent });
}
