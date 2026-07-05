"use client";

import { useState } from "react";
import type { ReportData, TxRow, RequestSummary } from "./page";

function pence(p: number) {
  return `£${(p / 100).toFixed(2)}`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function KpiCard({ label, value, sub, colour }: { label: string; value: string; sub?: string; colour: string }) {
  return (
    <div className={`rounded-xl border p-5 bg-white ${colour}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function CollectionBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const colour = clamped >= 80 ? "bg-green-500" : clamped >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${colour}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{Math.round(clamped)}%</span>
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportTransactionsCsv(transactions: TxRow[]) {
  const rows = [
    ["Date", "Guardian email", "Payment request", "Child", "Amount (gross, £)", "Status"],
    ...transactions.flatMap((tx) =>
      tx.lines.map((l) => [
        fmtDate(tx.created_at),
        tx.guardian_email,
        l.request_title,
        l.student_name,
        (l.amount_pence / 100).toFixed(2),
        tx.status,
      ])
    ),
  ];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportRequestsCsv(requests: RequestSummary[]) {
  const rows = [
    ["Payment request", "Due date", "Status", "Gross (£)", "Collected (£)", "Outstanding (£)", "Pupils", "Paid"],
    ...requests.map((r) => [
      r.title,
      r.due_date ? fmtDate(r.due_date) : "—",
      r.status,
      (r.gross_pence / 100).toFixed(2),
      (r.collected_pence / 100).toFixed(2),
      (r.outstanding_pence / 100).toFixed(2),
      r.assignment_count,
      r.paid_count,
    ]),
  ];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payment_requests_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "requests" | "transactions";

export default function ReportsClient({ data }: { data: ReportData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [txSearch, setTxSearch] = useState("");
  const [txPage, setTxPage] = useState(0);
  const PAGE_SIZE = 25;

  const collectionRatePct =
    data.totalCollectedPence + data.totalOutstandingPence > 0
      ? (data.totalCollectedPence / (data.totalCollectedPence + data.totalOutstandingPence)) * 100
      : 0;

  const termChange = data.lastTermPence > 0
    ? ((data.thisTermPence - data.lastTermPence) / data.lastTermPence) * 100
    : null;

  const filteredTx = data.transactions.filter(
    (t) =>
      t.guardian_email.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.lines.some((l) => l.request_title.toLowerCase().includes(txSearch.toLowerCase()) ||
        l.student_name.toLowerCase().includes(txSearch.toLowerCase()))
  );
  const pagedTx = filteredTx.slice(txPage * PAGE_SIZE, (txPage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["overview", "requests", "transactions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t === "requests" ? "Payment requests" : t === "transactions" ? "Transactions" : "Overview"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Collected (gross)"
              value={pence(data.totalCollectedPence)}
              sub="All time, succeeded payments"
              colour="border-green-200"
            />
            <KpiCard
              label="Outstanding (gross)"
              value={pence(data.totalOutstandingPence)}
              sub="Unpaid + partial assignments"
              colour="border-amber-200"
            />
            <KpiCard
              label="Est. fees paid"
              value={pence(data.totalFeesEstPence)}
              sub="~1.5% + 20p Stripe + 50p platform"
              colour="border-gray-200"
            />
            <KpiCard
              label="Collection rate"
              value={`${Math.round(collectionRatePct)}%`}
              sub="Collected ÷ total due"
              colour="border-blue-200"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Term comparison */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Term comparison</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">This term (gross)</span>
                  <span className="font-semibold text-gray-900">{pence(data.thisTermPence)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last term (gross)</span>
                  <span className="font-semibold text-gray-900">{pence(data.lastTermPence)}</span>
                </div>
                {termChange !== null && (
                  <div className={`text-xs font-medium mt-1 ${termChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {termChange >= 0 ? "+" : ""}{termChange.toFixed(1)}% vs last term
                  </div>
                )}
              </div>
            </div>

            {/* Top payment requests */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Payment requests — collection</h3>
              <div className="space-y-3">
                {data.requests.slice(0, 5).map((r) => (
                  <div key={r.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-700 truncate max-w-[60%]">{r.title}</span>
                      <span className="text-gray-500">{pence(r.collected_pence)} / {pence(r.gross_pence)} gross</span>
                    </div>
                    <CollectionBar pct={r.gross_pence > 0 ? (r.collected_pence / r.gross_pence) * 100 : 0} />
                  </div>
                ))}
                {data.requests.length === 0 && (
                  <p className="text-xs text-gray-400">No payment requests yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Fee disclosure */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Fee note</p>
            <p>All amounts shown are <strong>gross</strong> (what parents paid). Fees are deducted by Stripe before settlement to your account. Estimated fees shown above use ~1.5% + 20p per transaction (Stripe UK consumer card rate) plus 50p School2Pay platform fee. Actual net settled amounts appear in your Stripe dashboard.</p>
          </div>
        </div>
      )}

      {/* ── PAYMENT REQUESTS ── */}
      {tab === "requests" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">{data.requests.length} payment requests</p>
            <button
              onClick={() => exportRequestsCsv(data.requests)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-5 py-3 text-left">Due date</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Gross due</th>
                  <th className="px-5 py-3 text-right">Collected (gross)</th>
                  <th className="px-5 py-3 text-right">Outstanding (gross)</th>
                  <th className="px-5 py-3 text-center">Pupils</th>
                  <th className="px-5 py-3 text-left">Collection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.requests.map((r) => {
                  const pct = r.gross_pence > 0 ? (r.collected_pence / r.gross_pence) * 100 : 0;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900 max-w-xs truncate">{r.title}</td>
                      <td className="px-5 py-3 text-gray-500">{r.due_date ? fmtDate(r.due_date) : "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "open" ? "bg-green-100 text-green-700" :
                          r.status === "closed" ? "bg-gray-100 text-gray-600" :
                          "bg-amber-100 text-amber-700"
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">{pence(r.gross_pence)}</td>
                      <td className="px-5 py-3 text-right font-medium text-green-700">{pence(r.collected_pence)}</td>
                      <td className="px-5 py-3 text-right text-amber-700">{pence(r.outstanding_pence)}</td>
                      <td className="px-5 py-3 text-center text-gray-500">{r.paid_count}/{r.assignment_count}</td>
                      <td className="px-5 py-3 w-32"><CollectionBar pct={pct} /></td>
                    </tr>
                  );
                })}
                {data.requests.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">No payment requests yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {tab === "transactions" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              value={txSearch}
              onChange={(e) => { setTxSearch(e.target.value); setTxPage(0); }}
              placeholder="Search by email, request or child…"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => exportTransactionsCsv(data.transactions)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              Export CSV
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Parent email</th>
                    <th className="px-5 py-3 text-left">Payment request</th>
                    <th className="px-5 py-3 text-left">Child</th>
                    <th className="px-5 py-3 text-right">Amount (gross)</th>
                    <th className="px-5 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedTx.flatMap((tx) =>
                    tx.lines.map((line, i) => (
                      <tr key={`${tx.id}-${i}`} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                        <td className="px-5 py-3 text-gray-700 max-w-[180px] truncate">{tx.guardian_email}</td>
                        <td className="px-5 py-3 text-gray-700 max-w-[180px] truncate">{line.request_title}</td>
                        <td className="px-5 py-3 text-gray-500">{line.student_name}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900">{pence(line.amount_pence)}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                  {pagedTx.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                      {txSearch ? "No transactions match your search." : "No transactions yet."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">{filteredTx.length} transactions · page {txPage + 1} of {totalPages}</p>
                <div className="flex gap-2">
                  <button disabled={txPage === 0} onClick={() => setTxPage((p) => p - 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                  <button disabled={txPage >= totalPages - 1} onClick={() => setTxPage((p) => p + 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
