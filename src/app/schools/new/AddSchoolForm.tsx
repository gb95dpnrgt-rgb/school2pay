"use client";

import { useState } from "react";

export default function AddSchoolForm({
  action,
  existingTrustName,
}: {
  action: (formData: FormData) => Promise<void>;
  existingTrustName: string | null;
}) {
  const [trustMode, setTrustMode] = useState<"existing" | "new">(
    existingTrustName ? "existing" : "new"
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="trust_mode" value={trustMode} />

      {existingTrustName && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Trust</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setTrustMode("existing")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                trustMode === "existing"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              Add to {existingTrustName}
            </button>
            <button
              type="button"
              onClick={() => setTrustMode("new")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                trustMode === "new"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              New trust
            </button>
          </div>
        </div>
      )}

      {trustMode === "new" && (
        <div>
          <label htmlFor="legal_name" className="block text-sm font-medium text-gray-700 mb-1">
            Trust / Academy legal name
          </label>
          <input
            id="legal_name"
            name="legal_name"
            type="text"
            required={trustMode === "new"}
            placeholder="Oakwood Multi-Academy Trust"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label htmlFor="school_name" className="block text-sm font-medium text-gray-700 mb-1">
          School name
        </label>
        <input
          id="school_name"
          name="school_name"
          type="text"
          required
          placeholder="Oakwood Primary School"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="urn" className="block text-sm font-medium text-gray-700 mb-1">
          URN <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="urn"
          name="urn"
          type="text"
          placeholder="123456"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Create school
      </button>
    </form>
  );
}
