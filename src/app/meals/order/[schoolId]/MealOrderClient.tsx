"use client";

import { useState } from "react";
import type { PublicMenu, PublicStudent } from "./page";

function fmtDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function isToday(s: string) {
  return s === new Date().toISOString().slice(0, 10);
}

export default function MealOrderClient({
  menus,
  students,
  schoolId,
}: {
  menus: PublicMenu[];
  students: PublicStudent[];
  schoolId: string;
}) {
  // selections: { [menuId]: { [studentId]: optionId } }
  const [selections, setSelections] = useState<Record<string, Record<string, string>>>({});
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function selectOption(menuId: string, studentId: string, optionId: string) {
    setSelections((prev) => ({
      ...prev,
      [menuId]: { ...(prev[menuId] ?? {}), [studentId]: optionId },
    }));
  }

  function clearSelection(menuId: string, studentId: string) {
    setSelections((prev) => {
      const next = { ...prev, [menuId]: { ...(prev[menuId] ?? {}) } };
      delete next[menuId][studentId];
      return next;
    });
  }

  const totalSelections = Object.values(selections).reduce(
    (sum, byStudent) => sum + Object.keys(byStudent).length, 0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (totalSelections === 0) { setError("Please select at least one meal."); return; }

    setSubmitting(true);
    setError("");

    const orders: Array<{ menuId: string; studentId: string; optionId: string; date: string }> = [];
    for (const [menuId, byStudent] of Object.entries(selections)) {
      const menu = menus.find((m) => m.id === menuId);
      if (!menu) continue;
      for (const [studentId, optionId] of Object.entries(byStudent)) {
        orders.push({ menuId, studentId, optionId, date: menu.date });
      }
    }

    const res = await fetch("/api/meals/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, schoolId, orders }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-8 text-center space-y-2">
        <div className="text-3xl">✓</div>
        <h2 className="text-base font-semibold text-green-800">Orders placed!</h2>
        <p className="text-sm text-green-700">
          We've sent a confirmation to <strong>{email}</strong>. Your child's meals are booked.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <label className="block text-sm font-medium text-gray-700">Your email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="parent@example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">We'll send order confirmation to this address.</p>
      </div>

      {/* Menu per day */}
      {menus.map((menu) => (
        <div key={menu.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{fmtDate(menu.date)}</h2>
            {isToday(menu.date) && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Today · cutoff {menu.cutoff_time}</span>
            )}
          </div>

          {students.map((student) => {
            const selected = selections[menu.id]?.[student.id];
            return (
              <div key={student.id} className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {student.first_name} · Year {student.year_group}
                </p>
                <div className="flex flex-wrap gap-2">
                  {menu.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        selected === opt.id
                          ? clearSelection(menu.id, student.id)
                          : selectOption(menu.id, student.id, opt.id)
                      }
                      className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                        selected === opt.id
                          ? "border-blue-500 bg-blue-50 text-blue-800"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      <span className="font-medium">{opt.name}</span>
                      {opt.description && (
                        <span className="block text-xs text-gray-400">{opt.description}</span>
                      )}
                      {(opt.allergens ?? []).length > 0 && (
                        <span className="flex flex-wrap gap-1 mt-1.5">
                          {(opt.allergens ?? []).map((a) => (
                            <span key={a} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                              {a}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  ))}
                  {selected && (
                    <button
                      type="button"
                      onClick={() => clearSelection(menu.id, student.id)}
                      className="text-xs text-gray-400 hover:text-red-500 self-center px-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {submitting ? "Placing orders…" : `Place ${totalSelections} order${totalSelections !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
