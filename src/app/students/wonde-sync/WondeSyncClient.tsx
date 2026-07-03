"use client";

import { useState, useTransition } from "react";
import { previewWondeSync, confirmWondeSync } from "./actions";
import type { WondePreviewResult, WondeSyncResult } from "./actions";

export default function WondeSyncClient() {
  const [step, setStep] = useState<"form" | "preview" | "done">("form");
  const [preview, setPreview] = useState<Extract<WondePreviewResult, { ok: true }> | null>(null);
  const [result, setResult] = useState<WondeSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [isPending, startTransition] = useTransition();

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("wonde_token", token);
    fd.set("wonde_school_id", schoolId);

    startTransition(async () => {
      const res = await previewWondeSync(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res);
      setStep("preview");
    });
  }

  function handleConfirm() {
    const fd = new FormData();
    fd.set("wonde_token", token);
    fd.set("wonde_school_id", schoolId);

    startTransition(async () => {
      try {
        const res = await confirmWondeSync(fd);
        setResult(res);
        setStep("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3">
          <p className="text-lg font-bold text-green-800">Sync complete!</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Students added", value: result.studentsCreated },
              { label: "Students already existed", value: result.studentsSkipped },
              { label: "Guardians added", value: result.guardiansCreated },
              { label: "Guardian links created", value: result.linksCreated },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white border border-green-100 p-3">
                <p className="text-2xl font-bold text-green-700">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Your Wonde credentials have been saved. The system will auto-sync nightly to keep students up to date.
          </p>
        </div>
        <a
          href="/students"
          className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          View students →
        </a>
      </div>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-blue-900">Ready to import from {preview.schoolName}</p>
          <div className="flex gap-6 text-sm">
            <div><p className="text-2xl font-bold text-blue-800">{preview.totalStudents}</p><p className="text-xs text-gray-500">Students</p></div>
            <div><p className="text-2xl font-bold text-blue-800">{preview.totalGuardians}</p><p className="text-xs text-gray-500">Unique guardians</p></div>
          </div>
        </div>

        {/* Preview table */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Year</th>
                <th className="px-4 py-3 text-left">Guardian email(s)</th>
              </tr>
            </thead>
            <tbody>
              {preview.students.slice(0, 50).map((s, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-900">{s.firstName}</td>
                  <td className="px-4 py-2 text-gray-500">{s.yearGroup}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {s.guardians.map((g) => g.email).join(", ") || <span className="text-gray-300">No email</span>}
                  </td>
                </tr>
              ))}
              {preview.students.length > 50 && (
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-xs text-gray-400 text-center">
                    ...and {preview.students.length - 50} more
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep("form")}
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Syncing…" : `Confirm — import ${preview.totalStudents} students`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePreview} className="space-y-5 max-w-lg">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">What you&apos;ll need from Wonde:</p>
        <ul className="space-y-1 text-blue-700 ml-2">
          <li>• Your <strong>API token</strong> from app.wonde.com → Settings → API</li>
          <li>• Your <strong>school ID</strong> from app.wonde.com → Schools (looks like A0000000000)</li>
        </ul>
        <p className="text-xs text-blue-600 mt-2">
          Don&apos;t have a Wonde account yet? Apply at <strong>wonde.com/become-a-partner</strong>. Use sandbox ID <code className="bg-white px-1 rounded">A0000000000</code> to test.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Wonde API token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="your-wonde-api-token"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Wonde school ID
          <span className="ml-1 text-gray-400 font-normal">(leave blank to use sandbox)</span>
        </label>
        <input
          type="text"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          placeholder="A0000000000"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={isPending || !token}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Connecting to Wonde…" : "Connect and preview →"}
      </button>
    </form>
  );
}
