"use client";

import { useState } from "react";

export default function WondeConnectButton({ connected }: { connected: boolean }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleResync() {
    setSyncing(true);
    setSyncResult(null);
    setProgress(null);

    let offset = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalGuardians = 0;
    let grandTotal = 0;

    try {
      while (true) {
        setProgress(`Syncing students ${offset + 1}…`);
        const res = await fetch("/api/wonde/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Sync failed");

        totalCreated += data.students_created ?? 0;
        totalUpdated += data.students_updated ?? 0;
        totalGuardians += data.guardians_created ?? 0;
        grandTotal = data.total ?? grandTotal;

        setProgress(`Synced ${Math.min(offset + 20, grandTotal)} of ${grandTotal} students…`);

        if (data.done || data.next_offset == null) break;
        offset = data.next_offset;
      }

      setSyncResult(
        `Sync complete — ${totalCreated} students added, ${totalUpdated} updated, ${totalGuardians} guardians imported`
      );
    } catch (e: any) {
      setSyncResult(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }

  if (connected) {
    return (
      <div className="space-y-2">
        <button
          onClick={handleResync}
          disabled={syncing}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {syncing ? (progress ?? "Syncing…") : "Re-sync students now"}
        </button>
        {syncResult && (
          <p className={`text-xs ${syncResult.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {syncResult}
          </p>
        )}
      </div>
    );
  }

  return (
    <a
      href="/api/wonde/connect"
      className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Connect MIS via Wonde
    </a>
  );
}
