"use client";

import { useState, useTransition } from "react";
import { formatPence } from "@/lib/fees";

type Assignment = {
  id: string;
  amount_due_pence: number;
  amount_paid_pence: number;
  status: string;
  students: { first_name: string; year_group: string };
};

interface Props {
  assignments: Assignment[];
  guardianId: string;
  paymentRequestId: string;
  token: string;
  allowPartial: boolean;
}

const MIN_PARTIAL_PENCE = 100; // £1 minimum

export default function PaymentSelector({ assignments, guardianId, paymentRequestId, token, allowPartial }: Props) {
  const unpaid = assignments.filter((a) => a.status === "unpaid" || a.status === "partial");
  const alreadyPaid = assignments.filter((a) => a.status === "paid" || a.status === "waived");

  const [selected, setSelected] = useState<Set<string>>(new Set(unpaid.map((a) => a.id)));
  // partialAmounts: assignmentId → pence to pay (only used when allowPartial=true)
  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(unpaid.map((a) => [a.id, ((a.amount_due_pence - a.amount_paid_pence) / 100).toFixed(2)]))
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function remainingPence(a: Assignment) {
    return a.amount_due_pence - a.amount_paid_pence;
  }

  function resolvedAmountPence(a: Assignment): number {
    if (!allowPartial) return remainingPence(a);
    const raw = parseFloat(partialAmounts[a.id] ?? "");
    const pence = isNaN(raw) ? 0 : Math.round(raw * 100);
    return Math.min(Math.max(pence, 0), remainingPence(a));
  }

  const selectedAssignments = unpaid.filter((a) => selected.has(a.id));
  const total = selectedAssignments.reduce((s, a) => s + resolvedAmountPence(a), 0);

  function validate(): string | null {
    if (selectedAssignments.length === 0) return "Select at least one payment";
    if (allowPartial) {
      for (const a of selectedAssignments) {
        const pence = resolvedAmountPence(a);
        if (pence < MIN_PARTIAL_PENCE) return `Minimum payment is £1.00 per child`;
        if (pence > remainingPence(a)) return `Amount exceeds balance for ${a.students.first_name}`;
      }
    }
    return null;
  }

  function handleCheckout() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          guardianId,
          paymentRequestId,
          assignmentIds: [...selected],
          token,
        };
        if (allowPartial) {
          body.partialAmounts = Object.fromEntries(
            selectedAssignments.map((a) => [a.id, resolvedAmountPence(a)])
          );
        }
        const resp = await fetch("/api/pay/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (!resp.ok) { setError(data.error ?? "Checkout failed"); return; }
        window.location.href = data.url;
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Already paid */}
      {alreadyPaid.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Already paid</p>
          {alreadyPaid.map((a) => (
            <div key={a.id} className="flex justify-between text-sm text-green-800">
              <span>{a.students.first_name} ({a.students.year_group})</span>
              <span className="font-medium">{formatPence(a.amount_due_pence)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unpaid items */}
      {unpaid.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Outstanding {allowPartial && <span className="normal-case font-normal text-gray-400">— instalments allowed</span>}
            </p>
          </div>
          {unpaid.map((a) => {
            const isSelected = selected.has(a.id);
            const remaining = remainingPence(a);
            return (
              <div key={a.id} className={`border-b border-gray-100 last:border-0 transition-colors ${isSelected ? "bg-blue-50" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="w-full flex items-center justify-between px-4 py-4"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                    }`}>
                      {isSelected && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.students.first_name}</p>
                      <p className="text-xs text-gray-500">{a.students.year_group}</p>
                      {a.amount_paid_pence > 0 && (
                        <p className="text-xs text-blue-600">{formatPence(a.amount_paid_pence)} paid · {formatPence(remaining)} remaining</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatPence(remaining)}</span>
                </button>

                {/* Partial amount input */}
                {allowPartial && isSelected && (
                  <div className="px-4 pb-4 flex items-center gap-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Pay £</label>
                    <input
                      type="number"
                      min={(MIN_PARTIAL_PENCE / 100).toFixed(2)}
                      max={(remaining / 100).toFixed(2)}
                      step="0.01"
                      value={partialAmounts[a.id] ?? ""}
                      onChange={(e) => setPartialAmounts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button
                      type="button"
                      onClick={() => setPartialAmounts((prev) => ({ ...prev, [a.id]: (remaining / 100).toFixed(2) }))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Pay in full
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {unpaid.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-green-700 font-medium">All payments complete!</p>
          <p className="text-xs text-green-600 mt-1">Nothing outstanding for your children.</p>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {unpaid.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm font-semibold text-gray-900 px-1">
            <span>Total to pay now</span>
            <span>{formatPence(total)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={isPending || selectedAssignments.length === 0 || total < MIN_PARTIAL_PENCE}
            className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Redirecting…" : `Pay ${formatPence(total)}`}
          </button>
          <p className="text-center text-xs text-gray-400">Secure payment by Stripe. No card fee added.</p>
        </div>
      )}
    </div>
  );
}
