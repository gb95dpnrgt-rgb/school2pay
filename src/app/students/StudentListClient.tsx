"use client";

import { useState } from "react";
import type { StudentWithGuardians } from "./page";

export default function StudentListClient({ students }: { students: StudentWithGuardians[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? students.filter((s) =>
        s.first_name.toLowerCase().includes(query.toLowerCase()) ||
        s.year_group.toLowerCase().includes(query.toLowerCase())
      )
    : students;

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
        No students yet — import a CSV above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search by name or year group…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400">No students match your search.</p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-gray-500 text-xs font-semibold uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Parents / Guardians</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => {
              const guardians = student.guardian_student.map((gs) => {
                const g = Array.isArray(gs.guardians) ? gs.guardians[0] : gs.guardians;
                return g ? { ...g, relationship: gs.relationship } : null;
              }).filter(Boolean) as (NonNullable<ReturnType<typeof Object.assign>> & { relationship: string })[];

              return (
                <tr key={student.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{student.first_name}</td>
                  <td className="px-4 py-3 text-gray-500">{student.year_group}</td>
                  <td className="px-4 py-3">
                    {guardians.length === 0 ? (
                      <span className="text-gray-300 text-xs">None linked</span>
                    ) : (
                      <div className="space-y-0.5">
                        {guardians.map((g) => (
                          <div key={g.id} className="text-gray-600 text-xs">
                            <span className="font-medium">{g.email}</span>
                            {g.phone && <span className="text-gray-400 ml-2">{g.phone}</span>}
                            <span className="text-gray-400 ml-2 capitalize">({g.relationship})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
