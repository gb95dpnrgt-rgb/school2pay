"use client";

import { useState } from "react";

function pence(n: number) { return `£${(n / 100).toFixed(2)}`; }

type Student = { id: string; first_name: string; year_group: string };
type Club = {
  id: string; name: string; description: string | null;
  fee_model: string; fee_pence: number; sessions_per_term: number | null;
  day_of_week: string | null; start_date: string | null; end_date: string | null;
  max_capacity: number | null; status: string; schoolName: string;
};

export default function ClubSignUpClient({
  token,
  club,
  students,
  isFull,
  totalFeePence,
  justSignedUp,
}: {
  token: string;
  club: Club;
  students: Student[];
  isFull: boolean;
  totalFeePence: number;
  justSignedUp: boolean;
}) {
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [waitlisted, setWaitlisted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !studentId) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/clubs/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email, studentId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    if (data.waitlisted) {
      setWaitlisted(true);
      setLoading(false);
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    }
  }

  if (justSignedUp) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-green-200 p-8 max-w-md w-full text-center space-y-3">
          <p className="text-3xl">✓</p>
          <h1 className="text-xl font-bold text-gray-900">You're enrolled!</h1>
          <p className="text-sm text-gray-600">Payment received — your child is signed up for <strong>{club.name}</strong> at {club.schoolName}.</p>
        </div>
      </main>
    );
  }

  if (waitlisted) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-amber-200 p-8 max-w-md w-full text-center space-y-3">
          <p className="text-3xl">📋</p>
          <h1 className="text-xl font-bold text-gray-900">Added to waiting list</h1>
          <p className="text-sm text-gray-600">{club.name} is currently full. We'll email you at <strong>{email}</strong> if a place becomes available.</p>
        </div>
      </main>
    );
  }

  const byYear = students.reduce<Record<string, Student[]>>((acc, s) => {
    (acc[s.year_group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-gray-500">{club.schoolName}</p>
          <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
          {club.description && <p className="text-sm text-gray-500">{club.description}</p>}
        </div>

        {/* Club details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {club.day_of_week && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Day</p>
                <p className="font-medium text-gray-900">{club.day_of_week}s</p>
              </div>
            )}
            {club.start_date && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Starts</p>
                <p className="font-medium text-gray-900">{new Date(club.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</p>
              </div>
            )}
            {club.end_date && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Ends</p>
                <p className="font-medium text-gray-900">{new Date(club.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Fee</p>
              <p className="font-medium text-gray-900">
                {club.fee_model === "termly"
                  ? `${pence(club.fee_pence)} per term`
                  : `${pence(club.fee_pence)}/session × ${club.sessions_per_term} sessions`}
              </p>
            </div>
          </div>

          {isFull && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              This club is currently full — you can join the waiting list and we'll email you if a place opens up.
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <p className="text-lg font-bold text-gray-900">
              {isFull ? "Join waiting list (free)" : `Total: ${pence(totalFeePence)}`}
            </p>
            {!isFull && <p className="text-xs text-gray-400">Secure payment by card · No booking fees</p>}
          </div>
        </div>

        {/* Sign-up form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Your details</h2>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Your email address *</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select your child *</label>
            <select required value={studentId} onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— choose —</option>
              {Object.keys(byYear).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((year) => (
                <optgroup key={year} label={year}>
                  {byYear[year].map((s) => (
                    <option key={s.id} value={s.id}>{s.first_name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading || !email || !studentId}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            {loading
              ? "Please wait…"
              : isFull
              ? "Join waiting list"
              : `Pay ${pence(totalFeePence)} and enrol`}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 pb-4">
          {club.schoolName} · Powered by School2Pay
        </p>
      </div>
    </main>
  );
}
