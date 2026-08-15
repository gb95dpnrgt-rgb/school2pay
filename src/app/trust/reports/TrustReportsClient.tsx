"use client";

import { useState } from "react";
import type { TrustReportData } from "./page";

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TrustReportsClient({ data }: { data: TrustReportData }) {
  const [tab, setTab] = useState<"income" | "payouts">("income");

  function downloadIncomeCSV() {
    const rows = [
      ["School", "Transactions", "Gross Collected", "Est. Fees", "Net to School", "Outstanding"],
      ...data.schools.map((s) => [
        s.schoolName,
        String(s.transactionCount),
        (s.collectedPence / 100).toFixed(2),
        (s.feesEstPence / 100).toFixed(2),
        (s.netPence / 100).toFixed(2),
        (s.outstandingPence / 100).toFixed(2),
      ]),
      [],
      ["TOTAL", "", (data.totalCollectedPence / 100).toFixed(2), (data.totalFeesEstPence / 100).toFixed(2), (data.totalNetPence / 100).toFixed(2), (data.totalOutstandingPence / 100).toFixed(2)],
    ];
    downloadCSV(rows, `${data.trustName.replace(/\s+/g, "_")}_income_summary.csv`);
  }

  function downloadPayoutsCSV() {
    const rows = [
      ["School", "Arrival Date", "Gross (£)", "Stripe Fees (£)", "App Fees (£)", "Net (£)", "Stripe Payout ID"],
      ...data.payouts.map((p) => [
        p.schoolName,
        p.arrivalDate,
        (p.grossPence / 100).toFixed(2),
        (p.stripeFeePence / 100).toFixed(2),
        (p.appFeePence / 100).toFixed(2),
        (p.netPence / 100).toFixed(2),
        p.stripePayoutId,
      ]),
    ];
    downloadCSV(rows, `${data.trustName.replace(/\s+/g, "_")}_payouts.csv`);
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total collected (gross)" value={pence(data.totalCollectedPence)} />
        <KpiCard label="Est. fees" value={pence(data.totalFeesEstPence)} sub="Stripe + School2Pay" />
        <KpiCard label="Net to schools" value={pence(data.totalNetPence)} highlight />
        <KpiCard label="Outstanding" value={pence(data.totalOutstandingPence)} warn={data.totalOutstandingPence > 0} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["income", "payouts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "income" ? "Income by School" : "Payout History"}
          </button>
        ))}
      </div>

      {tab === "income" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={downloadIncomeCSV}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">School</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Transactions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Gross collected</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Est. fees</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Net to school</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.schools.map((s) => (
                  <tr key={s.schoolId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.schoolName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{s.transactionCount}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{pence(s.collectedPence)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{pence(s.feesEstPence)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{pence(s.netPence)}</td>
                    <td className={`px-4 py-3 text-right ${s.outstandingPence > 0 ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                      {pence(s.outstandingPence)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-gray-900">Trust total</td>
                  <td className="px-4 py-3 text-right text-gray-600">—</td>
                  <td className="px-4 py-3 text-right text-gray-900">{pence(data.totalCollectedPence)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{pence(data.totalFeesEstPence)}</td>
                  <td className="px-4 py-3 text-right text-green-700">{pence(data.totalNetPence)}</td>
                  <td className={`px-4 py-3 text-right ${data.totalOutstandingPence > 0 ? "text-amber-600" : "text-gray-400"}`}>
                    {pence(data.totalOutstandingPence)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {data.schools.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No income data yet.</p>
            )}
          </div>
          <p className="text-xs text-gray-400">* Fees are estimated (50p flat + 1.5% Stripe processing). Actual figures shown in payout history.</p>
        </div>
      )}

      {tab === "payouts" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={downloadPayoutsCSV}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">School</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Arrival date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Gross</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Stripe fees</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">App fees</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Net paid out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.schoolName}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(p.arrivalDate)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{pence(p.grossPence)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{pence(p.stripeFeePence)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{pence(p.appFeePence)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{pence(p.netPence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.payouts.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No payouts yet. Payouts appear here once Stripe transfers funds to school bank accounts.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, highlight = false, warn = false }: {
  label: string; value: string; sub?: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-green-200 bg-green-50" : warn ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-green-700" : warn ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
