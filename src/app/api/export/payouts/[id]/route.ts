import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { buildCsv, csvResponse } from "@/lib/csv";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: school } = await supabase.from("schools").select("id").single();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payout } = await (admin.from("payouts") as any)
    .select("stripe_payout_id, arrival_date")
    .eq("id", id)
    .eq("school_id", school?.id)
    .maybeSingle() as { data: { stripe_payout_id: string; arrival_date: string } | null };

  if (!payout) return new Response("Not found", { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lines } = await (admin.from("payout_lines") as any)
    .select("type, description, stripe_balance_txn_id, stripe_payment_intent_id, stripe_charge_id, gross_pence, stripe_fee_pence, app_fee_pence, net_pence, matched")
    .eq("payout_id", id)
    .order("matched", { ascending: false })
    .order("gross_pence", { ascending: false }) as {
      data: Array<{
        type: string; description: string | null;
        stripe_balance_txn_id: string; stripe_payment_intent_id: string | null; stripe_charge_id: string | null;
        gross_pence: number; stripe_fee_pence: number; app_fee_pence: number; net_pence: number; matched: boolean;
      }> | null;
    };

  const headers = [
    "Type", "Description", "Balance txn ID", "Payment intent ID", "Charge ID",
    "Gross (£)", "Stripe fee (£)", "App fee (£)", "Net (£)", "Matched",
  ];

  const rows = (lines ?? []).map((l) => [
    l.type,
    l.description ?? "",
    l.stripe_balance_txn_id,
    l.stripe_payment_intent_id ?? "",
    l.stripe_charge_id ?? "",
    (Math.abs(l.gross_pence) / 100).toFixed(2),
    (l.stripe_fee_pence / 100).toFixed(2),
    (l.app_fee_pence / 100).toFixed(2),
    (l.net_pence / 100).toFixed(2),
    l.matched ? "Yes" : "No — REVIEW REQUIRED",
  ]);

  const dateStr = new Date(payout.arrival_date).toISOString().slice(0, 10);
  return csvResponse(buildCsv(headers, rows), `payout_${dateStr}_${payout.stripe_payout_id}.csv`);
}
