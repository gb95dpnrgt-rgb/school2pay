"use client";

import { useState } from "react";
import { archiveSchool } from "./actions";

export default function ArchiveSchoolButton({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Archive {schoolName}?</span>
        <button
          onClick={async () => {
            setLoading(true);
            await archiveSchool(schoolId);
          }}
          disabled={loading}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {loading ? "Archiving…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
    >
      Archive
    </button>
  );
}
