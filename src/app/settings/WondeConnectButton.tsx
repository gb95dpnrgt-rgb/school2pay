"use client";

import { useState } from "react";

export default function WondeConnectButton({ connected }: { connected: boolean }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function handleResync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/wonde/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncResult(`Sync complete: ${data.students_updated} updated, ${data.students_created} added`);
    } catch (e: any) {
      setSyncResult(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
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
          {syncing ? "Syncing…" : "Re-sync students now"}
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
