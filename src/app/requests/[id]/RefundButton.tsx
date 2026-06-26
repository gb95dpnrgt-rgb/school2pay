"use client";

import { useState, useTransition } from "react";
import { refundAssignment } from "./actions";

export default function RefundButton({
  assignmentId,
  requestId,
  studentName,
  amountPaidPence,
}: {
  assignmentId: string;
  requestId: string;
  studentName: string;
  amountPaidPence: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const amountStr = `£${(amountPaidPence / 100).toFixed(2)}`;

  function handleRefund() {
    setError(null);
    startTransition(async () => {
      try {
        await refundAssignment(assignmentId, requestId);
        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); setDone(false); }}
        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200"
      >
        Refund
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              Refund {amountStr} for {studentName}?
            </h2>
            <p className="text-sm text-gray-500">
              This issues a full refund via Stripe. The parent will receive their money back within 5–10 business days.
              The assignment will revert to <strong>unpaid</strong> once the refund is confirmed.
            </p>
            {done ? (
              <p role="status" className="text-sm font-medium text-green-700">
                Refund submitted to Stripe. The assignment will update shortly.
              </p>
            ) : error ? (
              <p role="alert" className="text-sm text-red-600">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                {done ? "Close" : "Cancel"}
              </button>
              {!done && (
                <button
                  onClick={handleRefund}
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Refunding…" : `Refund ${amountStr}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
