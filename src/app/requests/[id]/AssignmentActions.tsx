"use client";

import { useState, useTransition, useRef } from "react";
import { waivedAssignment, recordOfflinePayment } from "./actions";

type Modal = "none" | "waive" | "offline";

export default function AssignmentActions({
  assignmentId,
  requestId,
  studentName,
  amountDuePence,
}: {
  assignmentId: string;
  requestId: string;
  studentName: string;
  amountDuePence: number;
}) {
  const [modal, setModal] = useState<Modal>("none");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Waive state
  const [waiveNote, setWaiveNote] = useState("");

  // Offline payment state
  const [offlineAmount, setOfflineAmount] = useState(
    (amountDuePence / 100).toFixed(2)
  );
  const [offlineNote, setOfflineNote] = useState("");

  const noteRef = useRef<HTMLTextAreaElement>(null);

  function open(type: Modal) {
    setModal(type);
    setError(null);
    setDone(null);
    setWaiveNote("");
    setOfflineNote("");
    setOfflineAmount((amountDuePence / 100).toFixed(2));
  }

  function close() {
    if (isPending) return;
    setModal("none");
    setError(null);
    setDone(null);
  }

  function handleWaive() {
    setError(null);
    startTransition(async () => {
      try {
        await waivedAssignment(assignmentId, requestId, waiveNote || null);
        setDone("Assignment waived.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleOffline() {
    setError(null);
    const pence = Math.round(parseFloat(offlineAmount) * 100);
    if (!Number.isFinite(pence) || pence <= 0) {
      setError("Enter a valid positive amount");
      return;
    }
    if (!offlineNote.trim()) {
      setError("A note is required (e.g. 'Cash received 13 Jun')");
      noteRef.current?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const result = await recordOfflinePayment(
          assignmentId,
          requestId,
          pence,
          offlineNote
        );
        setDone(
          result.ledgerBalanced
            ? "Offline payment recorded. Ledger balanced ✓"
            : "Payment recorded. ⚠ Ledger imbalance detected — check logs."
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      {/* Action buttons (shown in table cell) */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => open("offline")}
          className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200"
        >
          Cash/cheque
        </button>
        <button
          onClick={() => open("waive")}
          className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 border border-gray-200"
        >
          Waive
        </button>
      </div>

      {/* Modal backdrop */}
      {modal !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            {/* ── Waive modal ─────────────────────────────── */}
            {modal === "waive" && (
              <>
                <h2 className="text-base font-semibold text-gray-900">
                  Waive payment for {studentName}?
                </h2>
                <p className="text-sm text-gray-500">
                  This marks the assignment as waived (free place). No money is
                  collected and no ledger entry is posted.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={waiveNote}
                    onChange={(e) => setWaiveNote(e.target.value)}
                    placeholder="e.g. pupil premium, hardship"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                    maxLength={255}
                  />
                </div>
                {done && (
                  <p className="text-sm font-medium text-green-700">{done}</p>
                )}
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={close}
                    disabled={isPending}
                    className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {done ? "Close" : "Cancel"}
                  </button>
                  {!done && (
                    <button
                      onClick={handleWaive}
                      disabled={isPending}
                      className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isPending ? "Saving…" : "Confirm waive"}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── Offline payment modal ───────────────────── */}
            {modal === "offline" && (
              <>
                <h2 className="text-base font-semibold text-gray-900">
                  Record offline payment — {studentName}
                </h2>
                <p className="text-sm text-gray-500">
                  Use for cash or cheque payments received outside Stripe.
                  Balanced ledger entries will be posted automatically.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Amount received (£)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={offlineAmount}
                      onChange={(e) => setOfflineAmount(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Note <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      ref={noteRef}
                      value={offlineNote}
                      onChange={(e) => setOfflineNote(e.target.value)}
                      placeholder="e.g. Cash received at office 13 Jun 2026"
                      rows={2}
                      maxLength={500}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    />
                  </div>
                </div>
                {done && (
                  <p className={`text-sm font-medium ${done.includes("⚠") ? "text-amber-700" : "text-green-700"}`}>
                    {done}
                  </p>
                )}
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={close}
                    disabled={isPending}
                    className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {done ? "Close" : "Cancel"}
                  </button>
                  {!done && (
                    <button
                      onClick={handleOffline}
                      disabled={isPending}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isPending ? "Saving…" : "Record payment"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
