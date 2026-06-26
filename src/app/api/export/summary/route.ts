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
  const { data: rows } = await (admin as any).rpc("monthly_collection_summary", {
    p_school_id: school?.id,
  }) as {
    data: Array<{
      month: string; payment_request_id: string; request_title: string;
      total_students: number; paid_count: number; waived_count: number;
      gross_collected_pence: number; net_collected_pence: number;
    }> | null;
  };

  const headers = [
    "Month", "Payment request", "Total students", "Paid", "Waived",
    "Gross collected (£)", "Est. net (£)",
  ];

  const csvRows = (rows ?? []).map((r) => [
    r.month,
    r.request_title,
    Number(r.total_students),
    Number(r.paid_count),
    Number(r.waived_count),
    (Number(r.gross_collected_pence) / 100).toFixed(2),
    (Number(r.net_collected_pence) / 100).toFixed(2),
  ]);

  return csvResponse(buildCsv(headers, csvRows), "monthly_summary.csv");
}
