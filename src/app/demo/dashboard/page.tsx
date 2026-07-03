import Link from "next/link";
import DemoNav from "../DemoNav";
import { PAYMENT_REQUESTS, formatPence } from "../data";

export default function DemoDashboard() {
  const open = PAYMENT_REQUESTS.filter((r) => r.status === "open");

  const totalExpected = open.reduce((s, r) => s + r.assignments.reduce((a, b) => a + b.amountDuePence, 0), 0);
  const totalCollected = open.reduce((s, r) => s + r.assignments.reduce((a, b) => a + b.amountPaidPence, 0), 0);
  const totalOutstanding = totalExpected - totalCollected;
  const pct = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  const urgentRequests = open.map((r) => {
    const unpaid = r.assignments.filter((a) => a.status === "unpaid").length;
    const outstanding = r.assignments.reduce((s, a) => s + (a.amountDuePence - a.amountPaidPence), 0);
    return { ...r, unpaid, outstanding };
  }).filter((r) => r.unpaid > 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <DemoNav active="dashboard" />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Oakwood Primary School</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Expected (gross)", value: formatPence(totalExpected), sub: `${open.length} open requests` },
            { label: "Collected (gross)", value: formatPence(totalCollected), sub: `${pct}% collection rate` },
            { label: "Outstanding (gross)", value: formatPence(totalOutstanding), sub: "across all requests", highlight: true },
            { label: "Active requests", value: String(open.length), sub: `${PAYMENT_REQUESTS.length} total` },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.highlight ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.highlight ? "text-amber-700" : "text-gray-900"}`}>{s.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Collection progress */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Overall collection rate</p>
            <p className="text-sm font-bold text-gray-900">{pct}%</p>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-green-400" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400">{formatPence(totalCollected)} collected of {formatPence(totalExpected)} expected</p>
        </div>

        {/* Urgent requests */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Needs attention</h2>
          <div className="space-y-2">
            {urgentRequests.map((r) => (
              <Link
                key={r.id}
                href={`/demo/requests/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Due {new Date(r.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600">{formatPence(r.outstanding)} outstanding</p>
                  <p className="text-xs text-gray-400">{r.unpaid} unpaid</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/demo/requests"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View all requests →
          </Link>
          <Link
            href="/demo/requests/pr1"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            View theatre trip →
          </Link>
        </div>
      </div>
    </main>
  );
}
