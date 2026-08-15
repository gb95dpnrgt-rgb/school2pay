import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import TrustReportsClient from "./TrustReportsClient";

export type SchoolIncomeSummary = {
  schoolId: string;
  schoolName: string;
  collectedPence: number;
  outstandingPence: number;
  feesEstPence: number;
  netPence: number;
  transactionCount: number;
};

export type TrustPayout = {
  id: string;
  schoolId: string;
  schoolName: string;
  arrivalDate: string;
  grossPence: number;
  stripeFeePence: number;
  appFeePence: number;
  netPence: number;
  stripePayoutId: string;
};

export type TrustReportData = {
  trustName: string;
  schools: SchoolIncomeSummary[];
  payouts: TrustPayout[];
  totalCollectedPence: number;
  totalOutstandingPence: number;
  totalNetPence: number;
  totalFeesEstPence: number;
};

function getAdmin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function TrustReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdmin();

  // Verify trust admin
  const { data: trustAdmin } = await (admin.from("trust_admin_users") as any)
    .select("trust_id, trusts(id, legal_name)")
    .eq("auth_user_id", user.id)
    .single() as {
      data: { trust_id: string; trusts: { id: string; legal_name: string } | null } | null
    };

  if (!trustAdmin) redirect("/dashboard");

  const trust = trustAdmin.trusts as { id: string; legal_name: string };
  const trustId = trust.id;

  // All schools in this trust
  const { data: schools } = await admin
    .from("schools")
    .select("id, name")
    .eq("trust_id", trustId)
    .order("name") as { data: Array<{ id: string; name: string }> | null };

  const schoolIds = (schools ?? []).map((s) => s.id);
  const schoolMap = new Map((schools ?? []).map((s) => [s.id, s.name]));

  if (schoolIds.length === 0) {
    return <EmptyState trustName={trust.legal_name} />;
  }

  // All payment requests across trust
  const { data: allRequests } = await admin
    .from("payment_requests")
    .select("id, school_id")
    .in("school_id", schoolIds) as {
      data: Array<{ id: string; school_id: string }> | null
    };

  const requestIds = (allRequests ?? []).map((r) => r.id);
  const requestSchoolMap = new Map((allRequests ?? []).map((r) => [r.id, r.school_id]));

  // All assignments across trust
  const { data: assignments } = requestIds.length
    ? await admin
        .from("assignments")
        .select("payment_request_id, amount_due_pence, amount_paid_pence, status")
        .in("payment_request_id", requestIds) as {
          data: Array<{ payment_request_id: string; amount_due_pence: number; amount_paid_pence: number; status: string }> | null
        }
    : { data: [] };

  // All succeeded transactions for these schools (via transaction_lines → assignments → requests)
  const { data: txLines } = requestIds.length
    ? await admin
        .from("transaction_lines")
        .select("amount_pence, assignment_id, transactions!inner(id, status, amount_pence)")
        .eq("transactions.status", "succeeded") as {
          data: Array<{ amount_pence: number; assignment_id: string; transactions: { id: string; status: string; amount_pence: number } }> | null
        }
    : { data: [] };

  // All assignments to map to school
  const { data: assignmentRows } = requestIds.length
    ? await admin
        .from("assignments")
        .select("id, payment_request_id")
        .in("payment_request_id", requestIds) as {
          data: Array<{ id: string; payment_request_id: string }> | null
        }
    : { data: [] };

  const assignmentRequestMap = new Map((assignmentRows ?? []).map((a) => [a.id, a.payment_request_id]));

  // Build per-school income summaries
  const schoolStats = new Map<string, { collectedPence: number; outstandingPence: number; txCount: number }>();
  for (const s of schools ?? []) {
    schoolStats.set(s.id, { collectedPence: 0, outstandingPence: 0, txCount: 0 });
  }

  // Count transactions per school
  const countedTxIds = new Set<string>();
  for (const line of txLines ?? []) {
    const reqId = assignmentRequestMap.get(line.assignment_id);
    if (!reqId) continue;
    const schoolId = requestSchoolMap.get(reqId);
    if (!schoolId) continue;
    const stats = schoolStats.get(schoolId);
    if (!stats) continue;
    stats.collectedPence += line.amount_pence;
    const txId = (line.transactions as any).id;
    if (!countedTxIds.has(`${schoolId}:${txId}`)) {
      countedTxIds.add(`${schoolId}:${txId}`);
      stats.txCount += 1;
    }
  }

  // Outstanding per school
  for (const a of assignments ?? []) {
    const schoolId = requestSchoolMap.get(a.payment_request_id);
    if (!schoolId) continue;
    const stats = schoolStats.get(schoolId);
    if (!stats) continue;
    if (a.status === "unpaid" || a.status === "partial") {
      stats.outstandingPence += a.amount_due_pence - a.amount_paid_pence;
    }
  }

  const schoolSummaries: SchoolIncomeSummary[] = (schools ?? []).map((s) => {
    const stats = schoolStats.get(s.id) ?? { collectedPence: 0, outstandingPence: 0, txCount: 0 };
    const feesEst = stats.txCount * 50 + Math.ceil(stats.collectedPence * 0.015);
    return {
      schoolId: s.id,
      schoolName: s.name,
      collectedPence: stats.collectedPence,
      outstandingPence: stats.outstandingPence,
      feesEstPence: feesEst,
      netPence: stats.collectedPence - feesEst,
      transactionCount: stats.txCount,
    };
  });

  // All payouts across trust schools
  const { data: payoutsRaw } = schoolIds.length
    ? await admin
        .from("payouts")
        .select("id, school_id, arrival_date, gross_pence, stripe_fees_pence, app_fees_pence, net_pence, stripe_payout_id")
        .in("school_id", schoolIds)
        .order("arrival_date", { ascending: false }) as {
          data: Array<{
            id: string; school_id: string; arrival_date: string;
            gross_pence: number; stripe_fees_pence: number; app_fees_pence: number;
            net_pence: number; stripe_payout_id: string;
          }> | null
        }
    : { data: [] };

  const payouts: TrustPayout[] = (payoutsRaw ?? []).map((p) => ({
    id: p.id,
    schoolId: p.school_id,
    schoolName: schoolMap.get(p.school_id) ?? "Unknown",
    arrivalDate: p.arrival_date,
    grossPence: p.gross_pence,
    stripeFeePence: p.stripe_fees_pence,
    appFeePence: p.app_fees_pence,
    netPence: p.net_pence,
    stripePayoutId: p.stripe_payout_id,
  }));

  const totalCollectedPence = schoolSummaries.reduce((s, sc) => s + sc.collectedPence, 0);
  const totalOutstandingPence = schoolSummaries.reduce((s, sc) => s + sc.outstandingPence, 0);
  const totalFeesEstPence = schoolSummaries.reduce((s, sc) => s + sc.feesEstPence, 0);
  const totalNetPence = schoolSummaries.reduce((s, sc) => s + sc.netPence, 0);

  const data: TrustReportData = {
    trustName: trust.legal_name,
    schools: schoolSummaries,
    payouts,
    totalCollectedPence,
    totalOutstandingPence,
    totalNetPence,
    totalFeesEstPence,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/trust/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <span className="text-sm font-medium text-gray-900">Trust Reports</span>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trust Reports</h1>
          <p className="mt-1 text-sm text-gray-500">{trust.legal_name}</p>
        </div>
        <TrustReportsClient data={data} />
      </div>
    </main>
  );
}

function EmptyState({ trustName }: { trustName: string }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500">No schools linked to {trustName} yet.</p>
        <a href="/trust/dashboard" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Back to dashboard</a>
      </div>
    </main>
  );
}
