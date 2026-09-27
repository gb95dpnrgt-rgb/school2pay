"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WondeSyncPage() {
  const router = useRouter();
  const [state, setState] = useState<"syncing" | "done" | "error">("syncing");
  const [result, setResult] = useState<{ students_created: number; students_updated: number; guardians_created: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wonde/sync", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Sync failed");
        setResult(data);
        setState("done");
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setState("error");
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6 text-center">
        {state === "syncing" && (
          <>
            <div className="text-4xl animate-spin inline-block">⟳</div>
            <h1 className="text-xl font-bold text-gray-900">Importing students…</h1>
            <p className="text-sm text-gray-500">
              We&apos;re pulling your students and parent contacts from your MIS. This takes a few seconds.
            </p>
          </>
        )}

        {state === "done" && result && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="text-xl font-bold text-gray-900">Students imported</h1>
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800 space-y-1 text-left">
              <p><span className="font-semibold">{result.total}</span> students found in MIS</p>
              <p><span className="font-semibold">{result.students_created}</span> new students added</p>
              <p><span className="font-semibold">{result.students_updated}</span> existing students updated</p>
              <p><span className="font-semibold">{result.guardians_created}</span> new parent contacts added</p>
            </div>
            <p className="text-xs text-gray-400">
              Student data syncs automatically. You can re-sync anytime from Settings.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Go to dashboard →
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900">Sync failed</h1>
            <p className="text-sm text-red-600">{errorMsg}</p>
            <div className="space-y-2">
              <button
                onClick={() => { setState("syncing"); setErrorMsg(null); fetch("/api/wonde/sync", { method: "POST" }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data); setState("done"); }).catch((e) => { setErrorMsg(e.message); setState("error"); }); }}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Retry
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
