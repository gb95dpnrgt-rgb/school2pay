"use client";

import { useState } from "react";

const SYSTEMS = [
  { value: "generic", label: "Generic CSV" },
  { value: "ps_financials", label: "PS Financials" },
  { value: "access_dimensions", label: "Access Dimensions" },
  { value: "iris", label: "IRIS Financials" },
  { value: "sage", label: "Sage 50 / Sage Intacct" },
  { value: "xero", label: "Xero" },
  { value: "sims", label: "SIMS Finance" },
] as const;

export default function ExportForm() {
  const [system, setSystem] = useState("generic");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    const params = new URLSearchParams({ system, date_from: dateFrom, date_to: dateTo });
    const res = await fetch(`/api/reports/export?${params.toString()}`);
    if (!res.ok) {
      alert("Export failed: " + (await res.text()));
      setLoading(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `school2pay-export-${system}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  const descriptions: Record<string, string> = {
    generic: "Date, Reference, Description, Student, Year Group, Gross (£), Fees (£), Net (£), Status",
    ps_financials: "Mapped to PS Financials journal import: PostingDate, NominalCode, CostCentre, Reference, Description, Debit, Credit",
    access_dimensions: "Mapped to Access Dimensions: TxDate, Account, CostCentre, Reference, Narrative, Debit, Credit",
    iris: "Mapped to IRIS Financials: Date, Account, Project, Narrative, Dr, Cr",
    sage: "Mapped to Sage import format: Date, Reference, Description, Net, VAT, Gross",
    xero: "Mapped to Xero bank statement import: Date, Amount, Payee, Description, Reference",
    sims: "Mapped to SIMS Finance journal CSV: PostingDate, Account, CostCentre, Ref, Description, Amount",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Finance system</label>
        <select
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SYSTEMS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-400">{descriptions[system]}</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">To date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">What&apos;s included</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Succeeded transactions only (no pending, no failed)</li>
          <li>All amounts labelled: gross, fees, net</li>
          <li>Refunded transactions shown as negative lines</li>
        </ul>
      </div>

      <button
        onClick={handleExport}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Generating…" : "Download CSV"}
      </button>
    </div>
  );
}
