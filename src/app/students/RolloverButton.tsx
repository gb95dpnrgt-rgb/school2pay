"use client";

import { useState, useTransition } from "react";
import { getRolloverPreview, performRollover, type RolloverPreview } from "./actions";

type Step = "idle" | "selecting" | "confirming" | "done";

export default function RolloverButton({ yearGroups }: { yearGroups: string[] }) {
  const [step, setStep] = useState<Step>("idle");
  const [selectedYear, setSelectedYear] = useState(yearGroups[yearGroups.length - 1] ?? "");
  const [preview, setPreview] = useState<RolloverPreview | null>(null);
  const [result, setResult] = useState<{ promoted: number; deleted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openModal() {
    setStep("selecting");
    setError(null);
    setPreview(null);
    setResult(null);
  }

  function closeModal() {
    if (isPending) return;
    setStep("idle");
  }

  function loadPreview() {
    setError(null);
    startTransition(async () => {
      try {
        const p = await getRolloverPreview(selectedYear);
        setPreview(p);
        setStep("confirming");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load preview");
      }
    });
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await performRollover(selectedYear);
        setResult(r);
        setStep("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Rollover failed");
      }
    });
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        Year rollover
      </button>

      {step !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">

            {/* ── Step: selecting leaving year ── */}
            {step === "selecting" && (
              <>
                <h2 className="text-base font-semibold text-gray-900">Year group rollover</h2>
                <p className="text-sm text-gray-500">
                  Select the <strong>leaving year</strong> — students in this year will be removed.
                  All other students move up one year group.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Leaving year group
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {yearGroups.map((yg) => (
                      <option key={yg} value={yg}>{yg}</option>
                    ))}
                  </select>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={closeModal} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">
                    Cancel
                  </button>
                  <button
                    onClick={loadPreview}
                    disabled={isPending || !selectedYear}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? "Loading…" : "Preview"}
                  </button>
                </div>
              </>
            )}

            {/* ── Step: confirming ── */}
            {step === "confirming" && preview && (
              <>
                <h2 className="text-base font-semibold text-gray-900">Confirm rollover</h2>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 space-y-1">
                  <p className="font-medium">This cannot be undone.</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-700">
                    <li><strong>{preview.leaverCount}</strong> students in <strong>{preview.leavingYear}</strong> will be permanently deleted</li>
                    <li><strong>{preview.promotedCount}</strong> students will move up one year group</li>
                  </ul>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setStep("selecting")} disabled={isPending} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                    Back
                  </button>
                  <button
                    onClick={confirm}
                    disabled={isPending}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isPending ? "Running…" : "Run rollover"}
                  </button>
                </div>
              </>
            )}

            {/* ── Step: done ── */}
            {step === "done" && result && (
              <>
                <h2 className="text-base font-semibold text-gray-900">Rollover complete</h2>
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
                  <p>✓ <strong>{result.promoted}</strong> students promoted</p>
                  <p>✓ <strong>{result.deleted}</strong> leavers removed</p>
                </div>
                <div className="flex justify-end">
                  <button onClick={closeModal} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                    Close
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
