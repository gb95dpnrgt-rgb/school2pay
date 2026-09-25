import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Row = {
  date: string;
  reference: string;
  description: string;
  student: string;
  year_group: string;
  gross_pence: number;
  fees_pence: number;
  net_pence: number;
  status: string;
  school: string;
  request_title: string;
};

function poundsStr(pence: number) {
  return (pence / 100).toFixed(2);
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

function mapRow(row: Row, system: string): string[] {
  const date = row.date.slice(0, 10);
  const gross = poundsStr(row.gross_pence);
  const fees = poundsStr(row.fees_pence);
  const net = poundsStr(row.net_pence);
  const ref = row.reference;
  const desc = `${row.request_title} — ${row.student} (${row.year_group})`;
  const isRefund = row.status === "refunded";

  switch (system) {
    case "ps_financials":
      return [date, "4000", row.school, ref, desc,
        isRefund ? "" : gross, isRefund ? gross : ""];
    case "access_dimensions":
      return [date, "4000", row.school, ref, desc,
        isRefund ? "" : gross, isRefund ? gross : ""];
    case "iris":
      return [date, "4000", "", desc,
        isRefund ? "" : gross, isRefund ? gross : ""];
    case "sage":
      return [date, ref, desc, net, "0.00", gross];
    case "xero":
      return [date, isRefund ? `-${gross}` : gross, row.student, desc, ref];
    case "sims":
      return [date, "4000", row.school, ref, desc,
        isRefund ? `-${gross}` : gross];
    default: // generic
      return [date, ref, row.request_title, row.student, row.year_group,
        gross, fees, net, row.status];
  }
}

function getHeaders(system: string): string[] {
  switch (system) {
    case "ps_financials":
      return ["PostingDate", "NominalCode", "CostCentre", "Reference", "Description", "Debit", "Credit"];
    case "access_dimensions":
      return ["TxDate", "Account", "CostCentre", "Reference", "Narrative", "Debit", "Credit"];
    case "iris":
      return ["Date", "Account", "Project", "Narrative", "Dr", "Cr"];
    case "sage":
      return ["Date", "Reference", "Description", "Net", "VAT", "Gross"];
    case "xero":
      return ["Date", "Amount", "Payee", "Description", "Reference"];
    case "sims":
      return ["PostingDate", "Account", "CostCentre", "Ref", "Description", "Amount"];
    default:
      return ["Date", "Reference", "Request", "Student", "YearGroup", "Gross(GBP)", "Fees(GBP)", "Net(GBP)", "Status"];
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });

  const { data: school } = await supabase.from("schools").select("id, name").single();
  if (!school) return new NextResponse("No school", { status: 400 });

  const system = req.nextUrl.searchParams.get("system") ?? "generic";
  const dateFrom = req.nextUrl.searchParams.get("date_from");
  const dateTo = req.nextUrl.searchParams.get("date_to");

  const admin = getAdmin();

  // Fetch transactions with lines, assignment, student, payment request
  let query = admin
    .from("transactions")
    .select(`
      id, stripe_payment_intent, amount_pence, status, created_at,
      transaction_lines(
        amount_pence,
        assignments!inner(
          payment_request_id,
          students!inner(first_name, year_group),
          payment_requests!inner(title, school_id)
        )
      )
    `)
    .in("status", ["succeeded", "refunded"]) as any;

  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59Z");

  const { data: txns, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });

  const rows: Row[] = [];

  for (const txn of txns ?? []) {
    for (const line of txn.transaction_lines ?? []) {
      const asgn = line.assignments;
      const reqData = asgn?.payment_requests;
      // Only include lines for this school
      if (reqData?.school_id !== school.id) continue;

      const grossPence = line.amount_pence as number;
      // Approximate fees: 1.5% + 20p Stripe + 50p S2P application fee
      const feesPence = Math.ceil(grossPence * 0.015) + 20 + 50;
      const netPence = Math.max(0, grossPence - feesPence);

      rows.push({
        date: txn.created_at,
        reference: txn.stripe_payment_intent ?? txn.id,
        description: reqData?.title ?? "",
        student: asgn?.students?.first_name ?? "",
        year_group: asgn?.students?.year_group ?? "",
        gross_pence: grossPence,
        fees_pence: feesPence,
        net_pence: netPence,
        status: txn.status,
        school: school.name,
        request_title: reqData?.title ?? "",
      });
    }
  }

  const headers = getHeaders(system);
  const csvRows = [headers, ...rows.map((r) => mapRow(r, system))];
  const csv = toCsv(csvRows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="school2pay-export-${system}.csv"`,
    },
  });
}
