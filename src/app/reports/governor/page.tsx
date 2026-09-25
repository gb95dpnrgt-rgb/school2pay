import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// UK school year terms
function getTermBounds(year: number) {
  return [
    { label: `Autumn ${year}`, start: new Date(`${year}-09-01`), end: new Date(`${year}-12-20`) },
    { label: `Spring ${year + 1}`, start: new Date(`${year + 1}-01-06`), end: new Date(`${year + 1}-04-11`) },
    { label: `Summer ${year + 1}`, start: new Date(`${year + 1}-04-22`), end: new Date(`${year + 1}-07-22`) },
  ];
}

export default async function GovernorSummaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  const admin = getAdmin();
  const schoolId = school?.id ?? "";

  // All closed/open requests for this school
  const { data: requests } = await (admin as any)
    .from("payment_requests")
    .select("id, title, request_type, status, amount_pence, due_date, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false }) as {
      data: Array<{
        id: string; title: string; request_type: string | null;
        status: string; amount_pence: number;
        due_date: string; created_at: string;
      }> | null;
    };

  // Assignments with remissions applied (status = waived)
  const { data: allAssignments } = await admin
    .from("assignments")
    .select(`
      id, status, amount_due_pence, amount_paid_pence,
      payment_requests!inner(school_id, due_date)
    `)
    .eq("payment_requests.school_id" as any, schoolId) as {
      data: Array<{
        id: string; status: string; amount_due_pence: number; amount_paid_pence: number;
        payment_requests: { school_id: string; due_date: string };
      }> | null;
    };

  // Term stats
  const now = new Date();
  const academicYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const terms = getTermBounds(academicYear);

  function assignmentsInTerm(start: Date, end: Date) {
    return (allAssignments ?? []).filter((a) => {
      const d = new Date(a.payment_requests.due_date);
      return d >= start && d <= end;
    });
  }

  const termStats = terms.map((t) => {
    const as = assignmentsInTerm(t.start, t.end);
    const total = as.length;
    const paid = as.filter((a) => a.status === "paid").length;
    const waived = as.filter((a) => a.status === "waived").length;
    const expectedPence = as.reduce((s, a) => s + a.amount_due_pence, 0);
    const collectedPence = as.reduce((s, a) => s + a.amount_paid_pence, 0);
    const collectionRate = total > 0 ? Math.round((paid / total) * 100) : 0;

    // Trip requests in this term
    const termRequests = (requests ?? []).filter((r) => {
      const d = new Date(r.due_date);
      return d >= t.start && d <= t.end;
    });
    const tripsRun = termRequests.filter((r) => r.request_type === "trip").length;
    const deficit = Math.max(0, expectedPence - collectedPence);

    return {
      label: t.label,
      total,
      paid,
      waived,
      tripsRun,
      expectedPence,
      collectedPence,
      deficit,
      collectionRate,
      hasDeficit: deficit > 0,
    };
  });

  // All-year totals
  const yearRequests = requests ?? [];
  const tripCount = yearRequests.filter((r) => r.request_type === "trip").length;
  const voluntaryCount = yearRequests.filter((r) => r.request_type === "voluntary").length;
  const totalWaived = (allAssignments ?? []).filter((a) => a.status === "waived").length;
  const totalExpectedPence = (allAssignments ?? []).reduce((s, a) => s + a.amount_due_pence, 0);
  const totalCollectedPence = (allAssignments ?? []).reduce((s, a) => s + a.amount_paid_pence, 0);
  const overallRate = (allAssignments ?? []).length > 0
    ? Math.round(((allAssignments ?? []).filter((a) => a.status === "paid").length / (allAssignments ?? []).length) * 100)
    : 0;

  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/reports/export" className="text-sm text-gray-500 hover:text-gray-800">Reports</a>
          <a href="/reports/governor" className="text-sm font-medium text-gray-900">Governor summary</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Governor summary</h1>
            <p className="mt-1 text-sm text-gray-500">
              {school?.name} · Academic year {academicYear}/{String(academicYear + 1).slice(2)} · Generated {generatedAt}
            </p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">For governor review only</span>
        </div>

        {/* Year overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total collected (gross)", value: `£${(totalCollectedPence / 100).toFixed(2)}`, sub: `of £${(totalExpectedPence / 100).toFixed(2)} expected` },
            { label: "Overall collection rate", value: `${overallRate}%`, sub: `across all requests` },
            { label: "Remissions granted", value: String(totalWaived), sub: "count only (no names)" },
            { label: "Trips run", value: String(tripCount), sub: `+ ${voluntaryCount} voluntary collections` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Per-term breakdown */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Per-term breakdown</h2>
          <div className="space-y-4">
            {termStats.map((t) => (
              <div key={t.label} className={`rounded-xl border bg-white p-5 space-y-4 ${t.hasDeficit ? "border-red-200" : "border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{t.label}</h3>
                  {t.hasDeficit && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Deficit</span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Trips run</p>
                    <p className="text-lg font-bold text-gray-900">{t.tripsRun}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Collection rate</p>
                    <p className="text-lg font-bold text-gray-900">{t.collectionRate}%</p>
                    <p className="text-xs text-gray-400">{t.paid} / {t.total} paid</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Remissions granted</p>
                    <p className="text-lg font-bold text-gray-900">{t.waived}</p>
                    <p className="text-xs text-gray-400">count only</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t.hasDeficit ? "Deficit (gross)" : "Surplus (gross)"}</p>
                    <p className={`text-lg font-bold ${t.hasDeficit ? "text-red-600" : "text-green-700"}`}>
                      {t.hasDeficit ? "−" : "+"}£{(Math.abs(t.collectedPence - t.expectedPence) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{ width: `${t.collectionRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-xs text-gray-500 space-y-1">
          <p className="font-semibold">Notes for governors</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>All amounts are gross (what parents paid). Net amounts after Stripe and platform fees are in the Finance Export.</li>
            <li>Remissions are reported as a count only. Individual names are not disclosed in this report to protect families&apos; privacy.</li>
            <li>Collection rates exclude waived assignments from the denominator.</li>
            <li>Term dates are indicative (first/last weeks of term). Exact school term dates may vary.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
