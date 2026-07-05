"use client";

import { useState } from "react";
import { saveMenu, deleteMenu } from "./actions";
import type { MealMenu, MenuOption } from "./page";

function fmtDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function fmtShort(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function getWeekDates(startMonday: string) {
  const base = new Date(startMonday + "T12:00:00");
  return WEEKDAYS.map((_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getMondayOfWeek(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  return monday.toISOString().slice(0, 10);
}

// ── Option editor ──────────────────────────────────────────────────────────

function OptionEditor({
  options,
  onChange,
}: {
  options: MenuOption[];
  onChange: (opts: MenuOption[]) => void;
}) {
  function update(idx: number, field: keyof MenuOption, value: string) {
    const next = options.map((o, i) => i === idx ? { ...o, [field]: value } : o);
    onChange(next);
  }

  function add() {
    onChange([...options, { id: crypto.randomUUID(), name: "", description: "" }]);
  }

  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={opt.id} className="flex gap-2 items-start">
          <div className="flex-1 space-y-1">
            <input
              value={opt.name}
              onChange={(e) => update(i, "name", e.target.value)}
              placeholder={`Option ${i + 1} (e.g. Pasta)`}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={opt.description}
              onChange={(e) => update(i, "description", e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button type="button" onClick={() => remove(i)} className="mt-1 text-gray-400 hover:text-red-500 text-lg">×</button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-xs text-blue-600 hover:underline">
        + Add option
      </button>
    </div>
  );
}

// ── Week setup form ──────────────────────────────────────────────────────────

function WeekSetupForm({ weekMonday, existingMenus, onDone }: {
  weekMonday: string;
  existingMenus: MealMenu[];
  onDone: () => void;
}) {
  const dates = getWeekDates(weekMonday);
  const existingByDate = new Map(existingMenus.map((m) => [m.date, m]));

  const [dayOptions, setDayOptions] = useState<Record<string, MenuOption[]>>(() => {
    const init: Record<string, MenuOption[]> = {};
    for (const date of dates) {
      const existing = existingByDate.get(date);
      init[date] = existing?.options ?? [
        { id: crypto.randomUUID(), name: "", description: "" },
        { id: crypto.randomUUID(), name: "", description: "" },
      ];
    }
    return init;
  });

  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    for (const date of dates) {
      const opts = (dayOptions[date] ?? []).filter((o) => o.name.trim());
      if (!opts.length) continue;
      const fd = new FormData();
      fd.append("date", date);
      fd.append("options", JSON.stringify(opts));
      fd.append("cutoff_time", "09:30");
      await saveMenu(fd);
    }
    setPending(false);
    onDone();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5">
        {dates.map((date, i) => (
          <div key={date} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">{WEEKDAYS[i]} — {fmtShort(date)}</h3>
            <OptionEditor
              options={dayOptions[date] ?? []}
              onChange={(opts) => setDayOptions((prev) => ({ ...prev, [date]: opts }))}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onDone}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={pending}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
          {pending ? "Saving…" : "Publish week's menu"}
        </button>
      </div>
    </div>
  );
}

// ── Day card ─────────────────────────────────────────────────────────────────

function DayCard({ menu, schoolId }: { menu: MealMenu; schoolId: string }) {
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function doDelete() {
    if (!confirm("Delete this day's menu?")) return;
    setDeleting(true);
    const fd = new FormData();
    fd.append("menu_id", menu.id);
    await deleteMenu(fd);
    setDeleting(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/meals/order/${schoolId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Group orders by option
  const byOption = menu.orders.reduce<Record<string, typeof menu.orders>>((acc, o) => {
    (acc[o.option_name] ??= []).push(o);
    return acc;
  }, {});

  const isToday = menu.date === new Date().toISOString().slice(0, 10);
  const isPast = menu.date < new Date().toISOString().slice(0, 10);

  return (
    <div className={`bg-white rounded-xl border p-5 space-y-4 ${isToday ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{fmtDate(menu.date)}</h3>
            {isToday && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Today</span>}
            {isPast && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Past</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Cutoff: {menu.cutoff_time} · {menu.orders.length} orders</p>
        </div>
        <button onClick={doDelete} disabled={deleting} className="text-xs text-gray-400 hover:text-red-500">
          {deleting ? "…" : "Remove"}
        </button>
      </div>

      {/* Options */}
      <div className="flex gap-2 flex-wrap">
        {menu.options.map((opt) => (
          <span key={opt.id} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
            {opt.name}
          </span>
        ))}
      </div>

      {/* Orders summary */}
      {menu.orders.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Kitchen summary</p>
          {Object.entries(byOption).map(([optName, orders]) => (
            <div key={optName}>
              <p className="text-sm font-medium text-gray-800">{optName} <span className="text-gray-400">×{orders.length}</span></p>
              <p className="text-xs text-gray-500">{orders.map((o) => o.student.first_name).join(", ")}</p>
            </div>
          ))}
        </div>
      )}

      {menu.orders.length === 0 && !isPast && (
        <p className="text-xs text-gray-400">No orders yet</p>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MealsClient({ menus, schoolId }: { menus: MealMenu[]; schoolId: string }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const weekMonday = getMondayOfWeek(weekOffset);
  const weekDates = getWeekDates(weekMonday);
  const weekMenus = menus.filter((m) => weekDates.includes(m.date));

  function copyParentLink() {
    navigator.clipboard.writeText(`${window.location.origin}/meals/order/${schoolId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const weekLabel = (() => {
    const start = new Date(weekMonday + "T12:00:00");
    const end = new Date(weekMonday + "T12:00:00");
    end.setDate(end.getDate() + 4);
    return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">← Prev</button>
          <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
          <button onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Next →</button>
        </div>
        <div className="flex gap-2">
          <button onClick={copyParentLink}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            {copied ? "✓ Copied!" : "Copy parent link"}
          </button>
          <button onClick={() => setEditing(true)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Set up this week
          </button>
        </div>
      </div>

      {editing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Week of {weekLabel}</h2>
          <WeekSetupForm
            weekMonday={weekMonday}
            existingMenus={weekMenus}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : weekMenus.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center space-y-3">
          <p className="text-sm text-gray-500">No menu set for this week.</p>
          <button onClick={() => setEditing(true)}
            className="text-sm text-blue-600 hover:underline">Set up the week's menu →</button>
        </div>
      ) : (
        <div className="space-y-4">
          {weekMenus.map((menu) => (
            <DayCard key={menu.id} menu={menu} schoolId={schoolId} />
          ))}
        </div>
      )}
    </div>
  );
}
