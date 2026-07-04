"use client";

import { useState, useRef } from "react";
import { recordMeals, adminTopUp, saveDinnerSettings, toggleFsm } from "./actions";
import type { DinnerStudent, WalletRow, DinnerSettings } from "./page";

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Register tab ─────────────────────────────────────────────────────────────

function RegisterTab({ students }: { students: DinnerStudent[] }) {
  const [date, setDate] = useState(today());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const byYear = students.reduce<Record<string, DinnerStudent[]>>((acc, s) => {
    (acc[s.year_group] ??= []).push(s);
    return acc;
  }, {});

  const nonFsmStudents = students.filter((s) => !s.is_fsm);
  const allIds = nonFsmStudents.map((s) => s.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => checked.has(id));

  function toggleAll() {
    if (allSelected) {
      setChecked(new Set());
    } else {
      setChecked(new Set(allIds));
    }
  }

  async function submit() {
    if (checked.size === 0) return;
    setPending(true);
    const fd = new FormData();
    fd.append("date", date);
    checked.forEach((id) => fd.append("student_id", id));
    await recordMeals(fd);
    setPending(false);
    setDone(true);
    setChecked(new Set());
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all (non-FSM)"}
        </button>
        <span className="text-sm text-gray-500">{checked.size} selected</span>
      </div>

      {Object.keys(byYear).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((year) => (
        <div key={year} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{year}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {byYear[year].map((s) => (
              <label
                key={s.id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${s.is_fsm ? "opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  disabled={s.is_fsm}
                  checked={checked.has(s.id)}
                  onChange={(e) => {
                    const next = new Set(checked);
                    if (e.target.checked) next.add(s.id);
                    else next.delete(s.id);
                    setChecked(next);
                  }}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-900">{s.first_name}</span>
                {s.is_fsm && (
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">FSM</span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      {done && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          ✓ Meals recorded — wallets updated
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending || checked.size === 0}
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {pending ? "Saving…" : `Record ${checked.size} meal${checked.size !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

// ── Wallets tab ───────────────────────────────────────────────────────────────

function WalletsTab({
  wallets,
  threshold,
}: {
  wallets: WalletRow[];
  threshold: number;
}) {
  const [topUpGuardian, setTopUpGuardian] = useState<WalletRow | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submitTopUp() {
    if (!topUpGuardian || !amount) return;
    const penceVal = Math.round(parseFloat(amount) * 100);
    if (!penceVal || penceVal <= 0) return;
    setPending(true);
    const fd = new FormData();
    fd.append("guardian_id", topUpGuardian.guardian.id);
    fd.append("amount_pence", String(penceVal));
    fd.append("note", note || "Manual top-up");
    await adminTopUp(fd);
    setPending(false);
    setDone(true);
    setTopUpGuardian(null);
    setAmount("");
    setNote("");
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <div className="space-y-4">
      {done && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          ✓ Wallet topped up
        </div>
      )}

      {wallets.length === 0 && (
        <p className="text-sm text-gray-500 py-6 text-center">No wallets yet — they appear when a meal is first recorded or a parent tops up.</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Parent</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Children</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {wallets.map((w) => {
              const isNeg = w.balance_pence < 0;
              const isLow = !isNeg && w.balance_pence < threshold;
              return (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{w.guardian.email}</p>
                    {w.guardian.phone && <p className="text-xs text-gray-400">{w.guardian.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{w.students.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold tabular-nums ${isNeg ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"}`}>
                      {pence(w.balance_pence)}
                    </span>
                    {isNeg && <span className="ml-1 text-xs text-red-500">negative</span>}
                    {isLow && <span className="ml-1 text-xs text-amber-500">low</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setTopUpGuardian(w)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Top up
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Top-up modal */}
      {topUpGuardian && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Manual Top-up</h2>
            <p className="text-sm text-gray-600">
              Top up wallet for <strong>{topUpGuardian.guardian.email}</strong><br />
              Current balance: <strong>{pence(topUpGuardian.balance_pence)}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount (£)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 20.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Cash received"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setTopUpGuardian(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitTopUp}
                disabled={pending || !amount}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {pending ? "Saving…" : "Top up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FSM tab ───────────────────────────────────────────────────────────────────

function FsmTab({ students }: { students: DinnerStudent[] }) {
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(studentId: string, action: "add" | "remove") {
    setPending(studentId);
    const fd = new FormData();
    fd.append("student_id", studentId);
    fd.append("action", action);
    await toggleFsm(fd);
    setPending(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Free School Meals pupils are never charged when you record meals. Their names still appear in the register but are greyed out.
      </p>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Year</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">FSM Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{s.first_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.year_group}</td>
                <td className="px-4 py-3">
                  {s.is_fsm ? (
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      ✓ FSM
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Standard</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle(s.id, s.is_fsm ? "remove" : "add")}
                    disabled={pending === s.id}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                  >
                    {pending === s.id ? "…" : s.is_fsm ? "Remove FSM" : "Mark FSM"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ settings }: { settings: DinnerSettings }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    // Convert £ → pence
    const mealPrice = parseFloat(fd.get("meal_price") as string) * 100;
    const threshold = parseFloat(fd.get("threshold") as string) * 100;
    fd.set("price_per_meal_pence", String(Math.round(mealPrice)));
    fd.set("low_balance_threshold_pence", String(Math.round(threshold)));
    await saveDinnerSettings(fd);
    setPending(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meal price (£)
          </label>
          <input
            type="number"
            name="meal_price"
            min="0.01"
            step="0.01"
            defaultValue={(settings.price_per_meal_pence / 100).toFixed(2)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Default is £2.60</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Low balance alert threshold (£)
          </label>
          <input
            type="number"
            name="threshold"
            min="0"
            step="0.50"
            defaultValue={(settings.low_balance_threshold_pence / 100).toFixed(2)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Wallets below this appear in amber. Default £5.00</p>
        </div>
      </div>

      {saved && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          ✓ Settings saved
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

// ── Main tabs component ──────────────────────────────────────────────────────

const TABS = ["Register", "Wallets", "FSM", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function DinnerTabs({
  students,
  wallets,
  settings,
  schoolId,
}: {
  students: DinnerStudent[];
  wallets: WalletRow[];
  settings: DinnerSettings;
  schoolId: string;
}) {
  const [tab, setTab] = useState<Tab>("Register");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
            {t === "Wallets" && wallets.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {wallets.length}
              </span>
            )}
            {t === "FSM" && students.filter((s) => s.is_fsm).length > 0 && (
              <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                {students.filter((s) => s.is_fsm).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Register" && <RegisterTab students={students} />}
      {tab === "Wallets" && <WalletsTab wallets={wallets} threshold={settings.low_balance_threshold_pence} />}
      {tab === "FSM" && <FsmTab students={students} />}
      {tab === "Settings" && <SettingsTab settings={settings} />}
    </div>
  );
}
