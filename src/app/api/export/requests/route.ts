import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildCsv, csvResponse } from "@/lib/csv";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: requests } = await supabase
    .from("payment_requests")
    .select(`
      id, title, due_date, amount_pence, year_groups, status, created_at,
      assignments ( amount_due_pence, amount_paid_pence, status )
    `)
    .order("created_at", { ascending: false }) as {
      data: Array<{
        id: string;
        title: string;
        due_date: string;
        amount_pence: number;
        year_groups: string[] | null;
        status: string;
        created_at: string;
        assignments: Array<{ amount_due_pence: number; amount_paid_pence: number; status: string }>;
      }> | null;
    };

  const headers = [
    "Title",
    "Due date",
    "Target year groups",
    "Gross per pupil (£)",
    "Students",
    "Paid",
    "Unpaid",
    "Waived",
    "Expected gross (£)",
    "Collected gross (£)",
    "% collected",
    "Status",
  ];

  const rows = (requests ?? []).map((req) => {
    const asgns = req.assignments ?? [];
    const studentCount = asgns.length;
    const paidCount = asgns.filter((a) => a.status === "paid").length;
    const unpaidCount = asgns.filter((a) => a.status === "unpaid").length;
    const waivedCount = asgns.filter((a) => a.status === "waived").length;
    const expectedGross = asgns.reduce((s, a) => s + a.amount_due_pence, 0);
    const collectedGross = asgns
      .filter((a) => a.status === "paid")
      .reduce((s, a) => s + a.amount_due_pence, 0);
    const pct = expectedGross > 0 ? ((collectedGross / expectedGross) * 100).toFixed(1) : "0.0";

    return [
      req.title,
      new Date(req.due_date).toLocaleDateString("en-GB"),
      req.year_groups ? req.year_groups.join("; ") : "Whole school",
      (req.amount_pence / 100).toFixed(2),
      studentCount,
      paidCount,
      unpaidCount,
      waivedCount,
      (expectedGross / 100).toFixed(2),
      (collectedGross / 100).toFixed(2),
      pct,
      req.status,
    ];
  });

  const csv = buildCsv(headers, rows);
  return csvResponse(csv, "payment_requests.csv");
}
