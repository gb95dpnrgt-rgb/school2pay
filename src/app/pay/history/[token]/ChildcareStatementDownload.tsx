"use client";

import { useState } from "react";

const TERMS = [
  "Autumn 2026",
  "Summer 2026",
  "Spring 2026",
  "Autumn 2025",
  "Summer 2025",
  "Spring 2025",
];

export default function ChildcareStatementDownload({ token }: { token: string }) {
  const [term, setTerm] = useState(TERMS[0]);
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    const params = new URLSearchParams({ token, term });
    const res = await fetch(`/api/pay/childcare-statement?${params.toString()}`);
    if (!res.ok) {
      alert("Could not generate statement — no payments found for this term.");
      setLoading(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `childcare-statement-${term.replace(/ /g, "-").toLowerCase()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Childcare cost statement</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Download a PDF statement for Universal Credit childcare element or Tax-Free Childcare claims.
        </p>
      </div>
      <div className="flex gap-3 items-center">
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TERMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={download}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Generating…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
