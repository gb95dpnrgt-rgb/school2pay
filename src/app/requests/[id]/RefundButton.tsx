"use client";

import { useState } from "react";
import { refundAssignment } from "./actions";
import { formatPence } from "@/lib/fees";

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
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefund() {
    setLoading(true);
    setError(null);
    try {
      await refundAssignment(assignmentId, requestId);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-2 space-y-2 text-xs">
        <p className="text-red-700 font-medium">
          Refund {formatPence(amountPaidPence)} to {studentName}&apos;s guardian?
        </p>
        <p className="text-red-500">This cannot be undone. Stripe&apos;s fee is non-refundable.</p>
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleRefund}
            disabled={loading}
            className="rounded bg-red-600 px-2 py-1 text-white font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Refunding…" : "Confirm refund"}
          </button>
          <button
            onClick={() => { setConfirming(false); setError(null); }}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-red-500 hover:text-red-700 hover:underline"
    >
      Refund
    </button>
  );
}
