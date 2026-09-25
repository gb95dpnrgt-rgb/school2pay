"use client";

import { useState } from "react";

export default function AuditExportForm({ schoolId }: { schoolId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    const params = new URLSearchParams({ school_id: schoolId });
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    const res = await fetch(`/api/reports/audit-export?${params.toString()}`);
    if (!res.ok) {
      alert("Export failed. Please try again.");
      setLoading(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-audit-${from || "all"}-to-${to || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Download ledger CSV</h2>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From date</label>
          <input
            type="date" value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To date</label>
          <input
            type="date" value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={download}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Exporting…" : "Download CSV"}
        </button>
      </div>
      <p className="text-xs text-gray-400">Leave dates blank to export all entries.</p>
    </div>
  );
}
