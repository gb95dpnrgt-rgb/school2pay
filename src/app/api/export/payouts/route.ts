import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { buildCsv, csvResponse } from "@/lib/csv";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function GET() {
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
  const { data: payouts } = await (admin.from("payouts") as any)
    .select("stripe_payout_id, arrival_date, gross_pence, stripe_fees_pence, app_fees_pence, net_pence, unmatched_count, status, description")
    .eq("school_id", school?.id)
    .order("arrival_date", { ascending: false }) as {
      data: Array<{
        stripe_payout_id: string; arrival_date: string;
        gross_pence: number; stripe_fees_pence: number; app_fees_pence: number;
        net_pence: number; unmatched_count: number; status: string; description: string | null;
      }> | null;
    };

  const headers = [
    "Stripe payout ID", "Arrival date",
    "Gross (£)", "Stripe fees (£)", "App fees (£)", "Net to school (£)",
    "Unmatched transactions", "Status", "Description",
  ];

  const rows = (payouts ?? []).map((p) => [
    p.stripe_payout_id,
    new Date(p.arrival_date).toLocaleDateString("en-GB"),
    (p.gross_pence / 100).toFixed(2),
    (p.stripe_fees_pence / 100).toFixed(2),
    (p.app_fees_pence / 100).toFixed(2),
    (p.net_pence / 100).toFixed(2),
    p.unmatched_count,
    p.status,
    p.description ?? "",
  ]);

  return csvResponse(buildCsv(headers, rows), "payouts.csv");
}

