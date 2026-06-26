"use client";

import { useState, useTransition } from "react";
import { setRequestStatus } from "./actions";

export default function CloseRequestButton({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: string;
}) {
  const isOpen = currentStatus === "open";
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handle() {
    setError(null);
    startTransition(async () => {
      try {
        await setRequestStatus(requestId, isOpen ? "closed" : "open");
        setConfirm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setConfirm(true); setError(null); }}
        className={`rounded-lg border px-4 py-2 text-sm font-medium ${
          isOpen
            ? "border-gray-300 text-gray-600 hover:bg-gray-50"
            : "border-green-300 text-green-700 hover:bg-green-50"
        }`}
      >
        {isOpen ? "Close request" : "Reopen request"}
      </button>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setConfirm(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              {isOpen ? "Close this payment request?" : "Reopen this payment request?"}
            </h2>
            <p className="text-sm text-gray-500">
              {isOpen
                ? "Parents will no longer be able to pay via their link. Existing payments are unaffected. You can reopen it at any time."
                : "Parents will be able to pay again using their existing links (if still within the 7-day expiry)."}
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirm(false)}
                disabled={isPending}
                className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handle}
                disabled={isPending}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  isOpen ? "bg-gray-700 hover:bg-gray-800" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isPending
                  ? isOpen ? "Closing…" : "Reopening…"
                  : isOpen ? "Close request" : "Reopen request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
