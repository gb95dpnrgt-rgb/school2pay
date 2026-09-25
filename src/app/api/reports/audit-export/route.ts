import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const schoolId = req.nextUrl.searchParams.get("school_id");
  const dateFrom = req.nextUrl.searchParams.get("date_from");
  const dateTo = req.nextUrl.searchParams.get("date_to");

  if (!schoolId) return new NextResponse("Missing school_id", { status: 400 });

  const admin = getAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from("ledger_entries")
    .select(`
      id, account, debit_pence, credit_pence, created_at,
      transactions!inner(
        id, stripe_payment_intent, amount_pence, status,
        transaction_lines(
          amount_pence,
          assignments!inner(
            students!inner(first_name, year_group),
            payment_requests!inner(title, school_id)
          )
        )
      )
    `)
    .eq("transactions.transaction_lines.assignments.payment_requests.school_id", schoolId)
    .order("created_at", { ascending: true });

  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59Z");

  const { data: entries, error } = await query;
  if (error) return new NextResponse("Query failed", { status: 500 });

  const rows: string[] = [];
  rows.push(["entry_id", "date", "account", "debit_gross", "credit_gross", "transaction_id", "stripe_ref", "request_title", "student"].join(","));

  for (const entry of entries ?? []) {
    const txn = entry.transactions;
    const line = txn?.transaction_lines?.[0];
    const student = line?.assignments?.students;
    const requestTitle = line?.assignments?.payment_requests?.title ?? "";
    const studentLabel = student ? `${student.first_name} Yr${student.year_group}` : "";

    rows.push([
      entry.id,
      new Date(entry.created_at).toISOString().slice(0, 10),
      entry.account,
      entry.debit_pence > 0 ? (entry.debit_pence / 100).toFixed(2) : "",
      entry.credit_pence > 0 ? (entry.credit_pence / 100).toFixed(2) : "",
      txn?.id ?? "",
      txn?.stripe_payment_intent ?? "",
      `"${requestTitle.replace(/"/g, '""')}"`,
      `"${studentLabel}"`,
    ].join(","));
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="ledger-audit.csv"`,
    },
  });
}
