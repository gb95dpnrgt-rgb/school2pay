"use client";

import { useState } from "react";

type InstalmentRow = {
  label: string;
  amountPounds: string;
  dueDate: string;
};

export default function InstalmentBuilder() {
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<InstalmentRow[]>([
    { label: "Deposit", amountPounds: "", dueDate: "" },
    { label: "Balance", amountPounds: "", dueDate: "" },
  ]);

  function addRow() {
    setRows((r) => [...r, { label: "", amountPounds: "", dueDate: "" }]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function update(i: number, field: keyof InstalmentRow, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <input
          id="instalment_enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <label htmlFor="instalment_enabled" className="block text-sm font-medium text-gray-700 cursor-pointer">
            Split into instalment schedule
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            Define deposit and balance dates. Parents see the schedule on their payment page.
          </p>
        </div>
      </div>

      {enabled && (
        <div className="ml-7 space-y-3">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Amounts must add up to the total above. Parents can still pay any amount at any time — the schedule is guidance shown on their page.
          </p>
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="hidden"
                name={`instalment_label_${i}`}
                value={row.label}
              />
              <input
                type="hidden"
                name={`instalment_amount_${i}`}
                value={row.amountPounds}
              />
              <input
                type="hidden"
                name={`instalment_date_${i}`}
                value={row.dueDate}
              />
              <input
                value={row.label}
                onChange={(e) => update(i, "label", e.target.value)}
                placeholder="Label (e.g. Deposit)"
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">£</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={row.amountPounds}
                  onChange={(e) => update(i, "amountPounds", e.target.value)}
                  placeholder="0.00"
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                type="date"
                value={row.dueDate}
                onChange={(e) => update(i, "dueDate", e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {rows.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-gray-400 hover:text-red-500 mt-2"
                  aria-label="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <input type="hidden" name="instalment_count" value={rows.length} />
          <button
            type="button"
            onClick={addRow}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add instalment
          </button>
        </div>
      )}
    </div>
  );
}
