import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyHistoryToken } from "@/lib/magic-link";
import { generateChildcareStatementPdf } from "@/lib/childcare-statement-pdf";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// UK school term date ranges — approximate, schools vary
const TERMS: Record<string, { label: string; start: string; end: string }[]> = {
  "2026": [
    { label: "Autumn 2026", start: "2026-09-01", end: "2026-12-20" },
    { label: "Spring 2026", start: "2026-01-06", end: "2026-04-11" },
    { label: "Summer 2026", start: "2026-04-22", end: "2026-07-22" },
  ],
  "2025": [
    { label: "Autumn 2025", start: "2025-09-01", end: "2025-12-20" },
    { label: "Spring 2025", start: "2025-01-06", end: "2025-04-11" },
    { label: "Summer 2025", start: "2025-04-22", end: "2025-07-22" },
  ],
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const termKey = req.nextUrl.searchParams.get("term"); // e.g. "Autumn 2026"

  if (!token) return new NextResponse("Missing token", { status: 400 });

  let guardianId: string;
  try {
    const payload = await verifyHistoryToken(token);
    guardianId = payload.guardianId;
  } catch {
    return new NextResponse("Invalid or expired token", { status: 401 });
  }

  // Find matching term
  let termInfo: { label: string; start: string; end: string } | undefined;
  for (const terms of Object.values(TERMS)) {
    termInfo = terms.find((t) => t.label === termKey);
    if (termInfo) break;
  }
  if (!termInfo) return new NextResponse("Invalid term", { status: 400 });

  const admin = getAdmin();

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, email")
    .eq("id", guardianId)
    .single();
  if (!guardian) return new NextResponse("Not found", { status: 404 });

  // Fetch transactions in the term window
  const { data: txns } = await admin
    .from("transactions")
    .select(`
      id, amount_pence, created_at,
      transaction_lines(
        amount_pence,
        assignments!inner(
          students!inner(first_name, year_group),
          payment_requests!inner(title, schools!inner(name))
        )
      )
    `)
    .eq("guardian_id", guardianId)
    .eq("status", "succeeded")
    .gte("created_at", termInfo.start)
    .lte("created_at", termInfo.end + "T23:59:59Z")
    .order("created_at") as {
      data: Array<{
        id: string;
        amount_pence: number;
        created_at: string;
        transaction_lines: Array<{
          amount_pence: number;
          assignments: {
            students: { first_name: string; year_group: string };
            payment_requests: { title: string; schools: { name: string } };
          };
        }>;
      }> | null;
    };

  const rows: Array<{ date: string; requestTitle: string; studentName: string; amountPence: number }> = [];

  for (const txn of txns ?? []) {
    for (const line of txn.transaction_lines ?? []) {
      const student = line.assignments?.students;
      const request = line.assignments?.payment_requests;
      rows.push({
        date: txn.created_at,
        requestTitle: request?.title ?? "—",
        studentName: student ? `${student.first_name} (Yr ${student.year_group})` : "—",
        amountPence: line.amount_pence,
      });
    }
  }

  const totalPence = rows.reduce((s, r) => s + r.amountPence, 0);
  const schoolName = txns?.[0]?.transaction_lines?.[0]?.assignments?.payment_requests?.schools?.name ?? "";

  const pdf = await generateChildcareStatementPdf({
    guardianEmail: guardian.email,
    schoolName,
    termLabel: termInfo.label,
    termStart: termInfo.start,
    termEnd: termInfo.end,
    transactions: rows,
    totalPence,
  });

  const filename = `childcare-statement-${termInfo.label.replace(/ /g, "-").toLowerCase()}.pdf`;

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
