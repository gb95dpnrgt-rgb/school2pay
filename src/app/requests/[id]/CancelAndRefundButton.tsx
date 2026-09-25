"use client";

import { useState, useTransition } from "react";
import { cancelAndRefundAll } from "./actions";

export default function CancelAndRefundButton({
  requestId,
  paidCount,
}: {
  requestId: string;
  paidCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ refunded: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await cancelAndRefundAll(requestId);
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 font-medium"
      >
        Cancel &amp; refund all
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            {result ? (
              <>
                <h2 className="text-base font-semibold text-gray-900">Trip cancelled</h2>
                <p className="text-sm text-gray-600">
                  {result.refunded} refund{result.refunded !== 1 ? "s" : ""} issued via Stripe.
                  {result.failed > 0 && (
                    <span className="text-red-600"> {result.failed} failed — check Stripe dashboard.</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  Refunds typically appear within 5–10 working days. The Stripe webhook will update payment statuses automatically.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-900">Cancel trip and refund all?</h2>
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 space-y-1">
                  <p className="font-medium">This cannot be undone.</p>
                  <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                    <li>The request will be marked <strong>cancelled</strong></li>
                    <li>All {paidCount} paid parent{paidCount !== 1 ? "s" : ""} will be refunded via Stripe</li>
                    <li>Stripe webhooks will update ledger entries automatically</li>
                  </ul>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isPending ? "Processing…" : "Yes, cancel & refund"}
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
