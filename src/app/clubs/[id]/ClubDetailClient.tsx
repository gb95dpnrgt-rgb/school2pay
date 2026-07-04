"use client";

import { useState } from "react";
import { cancelEnrollment } from "../actions";
import type { Enrollment } from "./page";

function pence(n: number) { return `£${(n / 100).toFixed(2)}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

export default function ClubDetailClient({
  club,
  enrollments,
  schoolId,
}: {
  club: { id: string; name: string; fee_model: string; fee_pence: number; sessions_per_term: number | null; max_capacity: number | null; status: string; day_of_week: string | null; start_date: string | null; end_date: string | null };
  enrollments: Enrollment[];
  schoolId: string;
}) {
  const [cancelling, setCancelling] = useState<string | null>(null);

  const enrolled = enrollments.filter((e) => e.status === "enrolled");
  const waitlisted = enrollments.filter((e) => e.status === "waitlisted");
  const cancelled = enrollments.filter((e) => e.status === "cancelled");

  const totalFee = club.fee_model === "weekly"
    ? club.fee_pence * (club.sessions_per_term ?? 1)
    : club.fee_pence;

  async function doCancel(enrollmentId: string) {
    setCancelling(enrollmentId);
    const fd = new FormData();
    fd.append("enrollment_id", enrollmentId);
    fd.append("club_id", club.id);
    fd.append("school_id", schoolId);
    await cancelEnrollment(fd);
    setCancelling(null);
  }

  const statusBadge = (e: Enrollment) => {
    const payColour = e.payment_status === "paid" ? "text-green-700 bg-green-100" : "text-amber-700 bg-amber-100";
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payColour}`}>
        {e.payment_status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {club.day_of_week && `${club.day_of_week}s · `}
            {club.fee_model === "termly" ? `${pence(club.fee_pence)} per term` : `${pence(club.fee_pence)}/session × ${club.sessions_per_term} = ${pence(totalFee)}`}
            {club.max_capacity && ` · ${enrolled.length}/${club.max_capacity} places`}
          </p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${club.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          {club.status}
        </span>
      </div>

      {/* Enrolled */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Enrolled ({enrolled.length})
        </h2>
        {enrolled.length === 0 ? (
          <p className="text-sm text-gray-400">No enrolled pupils yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pupil</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Parent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Signed up</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrolled.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {e.student.first_name}
                      <span className="ml-1 text-xs text-gray-400">{e.student.year_group}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.guardian.email}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-3">{statusBadge(e)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => doCancel(e.id)}
                        disabled={cancelling === e.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-40"
                      >
                        {cancelling === e.id ? "…" : "Cancel"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Waitlist */}
      {waitlisted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Waiting list ({waitlisted.length})
          </h2>
          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-amber-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Position</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Pupil</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Parent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {waitlisted.sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0)).map((e) => (
                  <tr key={e.id} className="hover:bg-amber-50">
                    <td className="px-4 py-3 font-bold text-amber-700">#{e.waitlist_position}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {e.student.first_name}
                      <span className="ml-1 text-xs text-gray-400">{e.student.year_group}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.guardian.email}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => doCancel(e.id)}
                        disabled={cancelling === e.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-40"
                      >
                        {cancelling === e.id ? "…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Cancelled ({cancelled.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-60">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {cancelled.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5 text-gray-500">{e.student.first_name} {e.student.year_group}</td>
                    <td className="px-4 py-2.5 text-gray-400">{e.guardian.email}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">Cancelled</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
