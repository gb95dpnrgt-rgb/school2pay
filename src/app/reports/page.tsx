import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import ReportsClient from "./ReportsClient";

export type TxRow = {
  id: string;
  created_at: string;
  amount_pence: number;
  status: string;
  guardian_email: string;
  lines: Array<{
    amount_pence: number;
    assignment_id: string;
    request_title: string;
    student_name: string;
  }>;
};

export type RequestSummary = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  gross_pence: number;       // total amount_due across all assignments
  collected_pence: number;   // total amount_paid across all assignments
  outstanding_pence: number;
  assignment_count: number;
  paid_count: number;
};

export type ReportData = {
  schoolName: string;
  transactions: TxRow[];
  requests: RequestSummary[];
  // aggregates
  totalCollectedPence: number;
  totalOutstandingPence: number;
  totalFeesEstPence: number; // estimated: 50p flat + 1.5% of gross
  thisTermPence: number;
  lastTermPence: number;
};

function getAdmin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// UK school terms: rough date ranges
function termRange(now: Date): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  if (m >= 9) return { start: new Date(`${y}-09-01`), end: new Date(`${y}-12-20`) };
  if (m <= 4) return { start: new Date(`${y}-01-06`), end: new Date(`${y}-04-11`) };
  return { start: new Date(`${y}-04-22`), end: new Date(`${y}-07-22`) };
}

function prevTermRange(now: Date): { start: Date; end: Date } {
  const thisTerm = termRange(now);
  const prevEnd = new Date(thisTerm.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  return termRange(prevEnd);
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();
  if (!school) redirect("/login");

  const admin = getAdmin();

  // ── Transactions (succeeded only) ────────────────────────────────────────
  const { data: txRaw } = await admin
    .from("transactions")
    .select("id, created_at, amount_pence, status, guardian_id")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false }) as {
      data: Array<{ id: string; created_at: string; amount_pence: number; status: string; guardian_id: string }> | null
    };

  const txIds = (txRaw ?? []).map((t) => t.id);
  const guardianIds = [...new Set((txRaw ?? []).map((t) => t.guardian_id))];

  // Guardians
  const { data: guardians } = guardianIds.length
    ? await admin.from("guardians").select("id, email").in("id", guardianIds) as {
        data: Array<{ id: string; email: string }> | null
      }
    : { data: [] };
  const guardianMap = new Map((guardians ?? []).map((g) => [g.id, g.email]));

  // Transaction lines
  const { data: linesRaw } = txIds.length
    ? await admin
        .from("transaction_lines")
        .select("id, transaction_id, assignment_id, amount_pence")
        .in("transaction_id", txIds) as {
          data: Array<{ id: string; transaction_id: string; assignment_id: string; amount_pence: number }> | null
        }
    : { data: [] };

  const assignmentIds = [...new Set((linesRaw ?? []).map((l) => l.assignment_id))];

  // Assignments + payment requests + students
  const { data: assignmentsRaw } = assignmentIds.length
    ? await admin
        .from("assignments")
        .select("id, student_id, payment_request_id")
        .in("id", assignmentIds) as {
          data: Array<{ id: string; student_id: string; payment_request_id: string }> | null
        }
    : { data: [] };

  const requestIds = [...new Set((assignmentsRaw ?? []).map((a) => a.payment_request_id))];
  const studentIds = [...new Set((assignmentsRaw ?? []).map((a) => a.student_id))];

  const [{ data: requestsRaw }, { data: studentsRaw }] = await Promise.all([
    requestIds.length
      ? admin.from("payment_requests").select("id, title, due_date, status").in("id", requestIds) as Promise<{ data: Array<{ id: string; title: string; due_date: string | null; status: string }> | null }>
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? admin.from("students").select("id, first_name, year_group").in("id", studentIds) as Promise<{ data: Array<{ id: string; first_name: string; year_group: string }> | null }>
      : Promise.resolve({ data: [] }),
  ]);

  const requestMap = new Map((requestsRaw ?? []).map((r) => [r.id, r]));
  const studentMap = new Map((studentsRaw ?? []).map((s) => [s.id, s]));
  const assignmentMap = new Map((assignmentsRaw ?? []).map((a) => [a.id, a]));

  const linesByTx = new Map<string, typeof linesRaw extends Array<infer T> ? T[] : never[]>();
  for (const line of linesRaw ?? []) {
    if (!linesByTx.has(line.transaction_id)) linesByTx.set(line.transaction_id, [] as any);
    (linesByTx.get(line.transaction_id) as any[]).push(line);
  }

  const transactions: TxRow[] = (txRaw ?? [])
    .filter((tx) => {
      // Only include transactions linked to this school via assignments
      const lines = linesByTx.get(tx.id) ?? [];
      return lines.length > 0;
    })
    .map((tx) => {
      const lines = (linesByTx.get(tx.id) ?? []).map((l) => {
        const asgn = assignmentMap.get(l.assignment_id);
        const req = asgn ? requestMap.get(asgn.payment_request_id) : undefined;
        const student = asgn ? studentMap.get(asgn.student_id) : undefined;
        return {
          amount_pence: l.amount_pence,
          assignment_id: l.assignment_id,
          request_title: req?.title ?? "—",
          student_name: student ? `${student.first_name} (Yr ${student.year_group})` : "—",
        };
      });
      return {
        id: tx.id,
        created_at: tx.created_at,
        amount_pence: tx.amount_pence,
        status: tx.status,
        guardian_email: guardianMap.get(tx.guardian_id) ?? "—",
        lines,
      };
    });

  // ── Payment request summaries ────────────────────────────────────────────
  const { data: allAssignments } = await admin
    .from("assignments")
    .select("id, payment_request_id, student_id, amount_due_pence, amount_paid_pence, status")
    .in("payment_request_id", requestIds.length ? requestIds : ["00000000-0000-0000-0000-000000000000"]) as {
      data: Array<{ id: string; payment_request_id: string; student_id: string; amount_due_pence: number; amount_paid_pence: number; status: string }> | null
    };

  // Also fetch ALL payment requests for this school (not just those with transactions)
  const { data: allRequests } = await admin
    .from("payment_requests")
    .select("id, title, due_date, status, school_id")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false }) as {
      data: Array<{ id: string; title: string; due_date: string | null; status: string; school_id: string }> | null
    };

  const allRequestIds = (allRequests ?? []).map((r) => r.id);
  const { data: allAssignmentsFull } = allRequestIds.length
    ? await admin
        .from("assignments")
        .select("id, payment_request_id, amount_due_pence, amount_paid_pence, status")
        .in("payment_request_id", allRequestIds) as {
          data: Array<{ id: string; payment_request_id: string; amount_due_pence: number; amount_paid_pence: number; status: string }> | null
        }
    : { data: [] };

  const requests: RequestSummary[] = (allRequests ?? []).map((req) => {
    const asgns = (allAssignmentsFull ?? []).filter((a) => a.payment_request_id === req.id);
    const gross = asgns.reduce((s, a) => s + a.amount_due_pence, 0);
    const collected = asgns.reduce((s, a) => s + a.amount_paid_pence, 0);
    const paidCount = asgns.filter((a) => a.status === "paid" || a.status === "waived").length;
    return {
      id: req.id,
      title: req.title,
      due_date: req.due_date,
      status: req.status,
      gross_pence: gross,
      collected_pence: collected,
      outstanding_pence: gross - collected,
      assignment_count: asgns.length,
      paid_count: paidCount,
    };
  });

  // ── Aggregates ────────────────────────────────────────────────────────────
  const totalCollectedPence = transactions.reduce((s, t) => s + t.amount_pence, 0);
  const totalOutstandingPence = requests.reduce((s, r) => s + r.outstanding_pence, 0);
  // Fee estimate: 50p flat + 1.5% per transaction
  const totalFeesEstPence = transactions.reduce((s, t) => s + 50 + Math.ceil(t.amount_pence * 0.015), 0);

  const now = new Date();
  const term = termRange(now);
  const prevTerm = prevTermRange(now);

  const thisTermPence = transactions
    .filter((t) => new Date(t.created_at) >= term.start && new Date(t.created_at) <= term.end)
    .reduce((s, t) => s + t.amount_pence, 0);

  const lastTermPence = transactions
    .filter((t) => new Date(t.created_at) >= prevTerm.start && new Date(t.created_at) <= prevTerm.end)
    .reduce((s, t) => s + t.amount_pence, 0);

  const reportData: ReportData = {
    schoolName: school.name,
    transactions,
    requests,
    totalCollectedPence,
    totalOutstandingPence,
    totalFeesEstPence,
    thisTermPence,
    lastTermPence,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/reports" className="text-sm font-medium text-gray-900">Financial Reports</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="mt-1 text-sm text-gray-500">{school.name}</p>
        </div>
        <ReportsClient data={reportData} />
      </div>
    </main>
  );
}
