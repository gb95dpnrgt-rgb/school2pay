"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "syncing" | "done" | "error" | "not-connected";

export default function WondeSyncClient({ connected }: { connected: boolean }) {
  const [status, setStatus] = useState<Status>(connected ? "idle" : "not-connected");
  const [result, setResult] = useState<{ students: number; guardians: number; links: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSync() {
    setStatus("syncing");
    setError(null);
    try {
      const res = await fetch("/api/wonde/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(data);
      setStatus("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
      setStatus("error");
    }
  }

  if (status === "not-connected") {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-yellow-900">Wonde not connected</h2>
          <p className="mt-1 text-sm text-yellow-800">
            To sync pupils automatically from your MIS (SIMS, Bromcom, Arbor etc), you need to connect via Wonde.
          </p>
        </div>
        <ol className="text-sm text-yellow-800 space-y-2 list-decimal list-inside">
          <li>Sign up at <strong>wonde.com</strong> and request access to your school</li>
          <li>Wonde will contact your MIS administrator to approve data sharing</li>
          <li>Once approved, Wonde sends School2Pay your school token automatically</li>
          <li>Come back here and click <strong>Sync now</strong></li>
        </ol>
        <a
          href="https://wonde.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
        >
          Visit wonde.com →
        </a>
      </div>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-4">
        <h2 className="font-semibold text-green-900">Sync complete</h2>
        <ul className="text-sm text-green-800 space-y-1">
          <li>✓ {result.students} student{result.students !== 1 ? "s" : ""} synced</li>
          <li>✓ {result.guardians} guardian{result.guardians !== 1 ? "s" : ""} synced</li>
          <li>✓ {result.links} parent–student link{result.links !== 1 ? "s" : ""} created</li>
        </ul>
        <div className="flex gap-3">
          <a href="/students" className="rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">
            View students →
          </a>
          <button
            onClick={() => setStatus("idle")}
            className="rounded-lg border border-green-300 px-5 py-2 text-sm text-green-800 hover:bg-green-100"
          >
            Sync again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900">Sync from MIS via Wonde</h2>
        <p className="mt-1 text-sm text-gray-500">
          Pulls pupils, year groups, classes, and parent contacts directly from your school MIS.
          Existing records are updated; new ones are created. Nothing is deleted.
        </p>
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700 space-y-1">
        <p className="font-medium text-gray-800">What gets synced</p>
        <ul className="mt-1 space-y-0.5 text-gray-600 list-disc list-inside">
          <li>Pupil first name, year group, class</li>
          <li>Parent / guardian email and phone</li>
          <li>Parental responsibility flag (only responsible contacts imported)</li>
          <li>Parent–pupil relationship</li>
        </ul>
      </div>

      {status === "error" && error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      <button
        onClick={handleSync}
        disabled={status === "syncing"}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "syncing" ? "Syncing from MIS…" : "Sync now"}
      </button>

      <p className="text-xs text-gray-400">
        Wonde connected · Data is pulled securely via the Wonde API and never stored by Wonde beyond transit.
      </p>
    </div>
  );
}
