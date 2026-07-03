"use client";

import { useState } from "react";

interface Props {
  studentName: string;
  fields: Array<{ key: string; label: string }>;
  response: {
    guardianNameSigned: string;
    signedAt: string;
    responses: Record<string, string>;
  };
}

export default function DemoConsentModal({ studentName, fields, response }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:underline"
      >
        View consent
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Consent — {studentName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Signed by {response.guardianNameSigned} on{" "}
                  {new Date(response.signedAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-4">
              {fields.map((f) => (
                <div key={f.key} className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</p>
                  <p className="text-sm text-gray-900">{response.responses[f.key] ?? <span className="text-gray-400 italic">Not answered</span>}</p>
                </div>
              ))}
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
