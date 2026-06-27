"use client";

import { useState } from "react";

type ConsentField = { key: string; label: string; field_type: string };

type ConsentResponse = {
  id: string;
  responses: Record<string, unknown>;
  guardian_name_signed: string;
  signed_at: string;
  withdrawn_at: string | null;
};

interface Props {
  studentName: string;
  fields: ConsentField[];
  response: ConsentResponse | null;
  consentStatus: "consented" | "withdrawn" | null;
}

export default function ConsentResponseModal({ studentName, fields, response, consentStatus }: Props) {
  const [open, setOpen] = useState(false);

  const label =
    consentStatus === "consented" ? "View consent" :
    consentStatus === "withdrawn" ? "View (withdrawn)" :
    null;

  if (!label) return <span className="text-gray-300 text-xs">—</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:underline"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Consent — {studentName}</h2>
                {response && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Signed by {response.guardian_name_signed} on{" "}
                    {new Date(response.signed_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                    {response.withdrawn_at && (
                      <span className="ml-2 text-red-500 font-medium">
                        · Withdrawn {new Date(response.withdrawn_at).toLocaleDateString("en-GB")}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-4">
              {!response ? (
                <p className="text-sm text-gray-400">No consent response on record.</p>
              ) : (
                fields.map((f) => {
                  const val = response.responses[f.key];
                  const display = Array.isArray(val)
                    ? val.length > 0 ? val.join(", ") : "None selected"
                    : val != null && val !== ""
                    ? String(val)
                    : <span className="text-gray-400 italic">Not answered</span>;

                  return (
                    <div key={f.key} className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</p>
                      <p className="text-sm text-gray-900">{display}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
