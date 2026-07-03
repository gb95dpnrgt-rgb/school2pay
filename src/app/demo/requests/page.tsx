import Link from "next/link";
import DemoNav from "../DemoNav";
import { PAYMENT_REQUESTS, formatPence } from "../data";

export default function DemoRequests() {
  return (
    <main className="min-h-screen bg-gray-50">
      <DemoNav active="requests" />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">{PAYMENT_REQUESTS.length} total</p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-xs text-gray-400">
            + New request (demo)
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Title</th>
                <th className="px-5 py-3 text-left">Due</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Collected</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Consent</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_REQUESTS.map((r) => {
                const totalDue = r.assignments.reduce((s, a) => s + a.amountDuePence, 0);
                const totalPaid = r.assignments.reduce((s, a) => s + a.amountPaidPence, 0);
                const pct = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
                const consented = r.hasConsent
                  ? r.assignments.filter((a) => a.consentStatus === "consented").length
                  : null;

                return (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{r.description}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(r.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-gray-700">{formatPence(r.amountPence)}</td>
                    <td className="px-5 py-4 text-right">
                      <p className="font-mono text-gray-700">{formatPence(totalPaid)}</p>
                      <div className="mt-1 h-1.5 w-16 ml-auto rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-green-400" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        r.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {consented !== null
                        ? `${consented}/${r.assignments.length} consented`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/demo/requests/${r.id}`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
