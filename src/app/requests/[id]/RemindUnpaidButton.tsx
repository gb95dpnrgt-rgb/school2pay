"use client";

import { useState, useTransition } from "react";
import { getRemindSummary, remindUnpaid, type RemindSummary } from "./actions";
import { useRouter } from "next/navigation";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "confirm"; summary: RemindSummary }
  | { phase: "sending" }
  | { phase: "done"; sent: number }
  | { phase: "error"; message: string };

export default function RemindUnpaidButton({ requestId, unpaidCount }: { requestId: string; unpaidCount: number }) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (unpaidCount === 0) return null;

  const open = () => {
    setState({ phase: "loading" });
    startTransition(async () => {
      try {
        const summary = await getRemindSummary(requestId);
        setState({ phase: "confirm", summary });
      } catch (e) {
        setState({ phase: "error", message: (e as Error).message });
      }
    });
  };

  const send = () => {
    setState({ phase: "sending" });
    startTransition(async () => {
      try {
        const result = await remindUnpaid(requestId);
        setState({ phase: "done", sent: result.sent });
        router.refresh();
      } catch (e) {
        setState({ phase: "error", message: (e as Error).message });
      }
    });
  };

  const close = () => setState({ phase: "idle" });

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={state.phase === "loading"}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        {state.phase === "loading" ? "Checking…" : `Remind unpaid (${unpaidCount})`}
      </button>

      {/* Modal */}
      {(state.phase === "confirm" || state.phase === "sending" || state.phase === "done" || state.phase === "error") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
            {state.phase === "confirm" && (
              <>
                <h2 className="text-lg font-bold text-gray-900">Send chase reminders?</h2>

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-1 text-sm text-gray-700">
                  <p><span className="font-semibold">{state.summary.unpaidCount}</span> unpaid / partial students</p>
                  <p><span className="font-semibold">{state.summary.guardianCount}</span> {state.summary.guardianCount === 1 ? "guardian" : "guardians"} will receive an email</p>
                </div>

                {/* 48-hour cooldown warning */}
                {state.summary.recentlyChasedCount > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2">
                    <span className="shrink-0">⚠️</span>
                    <span>
                      <strong>{state.summary.recentlyChasedCount} {state.summary.recentlyChasedCount === 1 ? "guardian was" : "guardians were"}</strong> already chased within the last 48 hours
                      {state.summary.lastChaseAt && (
                        <> (last sent {new Date(state.summary.lastChaseAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })})</>
                      )}.
                      Sending again may feel spammy.
                    </span>
                  </div>
                )}

                {state.summary.guardianCount === 0 ? (
                  <p className="text-sm text-gray-500">No unpaid guardians to chase.</p>
                ) : (
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={send}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Send {state.summary.guardianCount} reminder{state.summary.guardianCount !== 1 ? "s" : ""}
                    </button>
                  </div>
                )}
                {state.summary.guardianCount === 0 && (
                  <div className="flex justify-end">
                    <button type="button" onClick={close} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Close</button>
                  </div>
                )}
              </>
            )}

            {state.phase === "sending" && (
              <div className="py-4 text-center text-sm text-gray-500">Sending reminders…</div>
            )}

            {state.phase === "done" && (
              <>
                <div className="text-center space-y-2 py-2">
                  <div className="text-3xl">✓</div>
                  <p className="font-semibold text-gray-900">
                    {state.sent} reminder{state.sent !== 1 ? "s" : ""} sent
                  </p>
                  <p className="text-sm text-gray-500">Each guardian received a fresh payment link.</p>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={close} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">Done</button>
                </div>
              </>
            )}

            {state.phase === "error" && (
              <>
                <p className="text-sm text-red-600">{state.message}</p>
                <div className="flex justify-end">
                  <button type="button" onClick={close} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
