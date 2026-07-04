"use client";

import { useState } from "react";
import { createClub, updateClubStatus, getSignUpLink } from "./actions";
import type { Club } from "./page";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`;
}

function totalFee(club: Club) {
  if (club.fee_model === "termly") return pence(club.fee_pence);
  const sessions = club.sessions_per_term ?? 1;
  return `${pence(club.fee_pence)}/session × ${sessions} = ${pence(club.fee_pence * sessions)}`;
}

// ── Create club form ──────────────────────────────────────────────────────────

function CreateClubForm({ onDone }: { onDone: () => void }) {
  const [feeModel, setFeeModel] = useState<"termly" | "weekly">("termly");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await createClub(new FormData(e.currentTarget));
    setPending(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Club name *</label>
          <input name="name" required placeholder="e.g. Football Club"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea name="description" rows={2} placeholder="Optional details for parents"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fee model *</label>
          <select name="fee_model" value={feeModel} onChange={(e) => setFeeModel(e.target.value as "termly" | "weekly")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="termly">Termly (flat fee)</option>
            <option value="weekly">Weekly (per session)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {feeModel === "termly" ? "Term fee (£) *" : "Per session fee (£) *"}
          </label>
          <input name="fee_pence" type="number" min="0.50" step="0.50" required placeholder="e.g. 45.00"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {feeModel === "weekly" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sessions per term *</label>
            <input name="sessions_per_term" type="number" min="1" required placeholder="e.g. 12"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Day of week</label>
          <select name="day_of_week"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— not set —</option>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max places</label>
          <input name="max_capacity" type="number" min="1" placeholder="Leave blank = unlimited"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
          <input name="start_date" type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End date</label>
          <input name="end_date" type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onDone}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={pending}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
          {pending ? "Creating…" : "Create club"}
        </button>
      </div>
    </form>
  );
}

// ── Club card ─────────────────────────────────────────────────────────────────

function ClubCard({ club, schoolId }: { club: Club; schoolId: string }) {
  const [linkPending, setLinkPending] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const isFull = club.max_capacity !== null && club.enrolled_count >= club.max_capacity;

  async function shareLink() {
    setLinkPending(true);
    const fd = new FormData();
    fd.append("club_id", club.id);
    fd.append("school_id", schoolId);
    const { url } = await getSignUpLink(fd);
    await navigator.clipboard.writeText(url);
    setLinkPending(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function toggleStatus() {
    setStatusPending(true);
    const fd = new FormData();
    fd.append("club_id", club.id);
    fd.append("status", club.status === "open" ? "closed" : "open");
    await updateClubStatus(fd);
    setStatusPending(false);
  }

  const statusColour = {
    open: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-600",
    draft: "bg-amber-100 text-amber-700",
  }[club.status];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{club.name}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColour}`}>
              {club.status}
            </span>
          </div>
          {club.description && <p className="text-sm text-gray-500">{club.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900">{totalFee(club)}</p>
          {club.day_of_week && <p className="text-xs text-gray-400">{club.day_of_week}s</p>}
        </div>
      </div>

      {/* Capacity bar */}
      {club.max_capacity !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{club.enrolled_count} enrolled</span>
            <span>{club.max_capacity} places</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : "bg-blue-500"}`}
              style={{ width: `${Math.min(100, (club.enrolled_count / club.max_capacity) * 100)}%` }}
            />
          </div>
          {club.waitlisted_count > 0 && (
            <p className="text-xs text-amber-600">{club.waitlisted_count} on waiting list</p>
          )}
        </div>
      )}
      {club.max_capacity === null && (
        <p className="text-xs text-gray-500">{club.enrolled_count} enrolled · unlimited places</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <a href={`/clubs/${club.id}`}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          View enrollments
        </a>
        <button onClick={shareLink} disabled={linkPending}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40">
          {linkPending ? "Generating…" : copied ? "✓ Link copied!" : "Copy sign-up link"}
        </button>
        <button onClick={toggleStatus} disabled={statusPending}
          className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40">
          {statusPending ? "…" : club.status === "open" ? "Close" : "Reopen"}
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ClubsClient({ clubs, schoolId }: { clubs: Club[]; schoolId: string }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-5">
      {creating ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">New club</h2>
          <CreateClubForm onDone={() => setCreating(false)} />
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          + New club
        </button>
      )}

      {clubs.length === 0 && !creating && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-sm text-gray-500">No clubs yet — create one above and share the sign-up link with parents.</p>
        </div>
      )}

      <div className="space-y-4">
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} schoolId={schoolId} />
        ))}
      </div>
    </div>
  );
}
