"use client";

import { useState } from "react";

export default function ComplianceFields() {
  const [showViability, setShowViability] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  return (
    <div className="space-y-4">
      {/* Viability threshold */}
      <div className="flex items-start gap-3">
        <input
          id="viability_enabled"
          type="checkbox"
          checked={showViability}
          onChange={(e) => setShowViability(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <label htmlFor="viability_enabled" className="block text-sm font-medium text-gray-700 cursor-pointer">
            Set viability threshold
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            Minimum amount needed to run the activity. If not met by the due date, one-click bulk refund is available.
          </p>
          {showViability && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">£</span>
              <input
                name="viability_threshold_pence_pounds"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500.00"
                className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">minimum to proceed</span>
            </div>
          )}
        </div>
      </div>

      {/* Policy link */}
      <div className="flex items-start gap-3">
        <input
          id="policy_enabled"
          type="checkbox"
          checked={showPolicy}
          onChange={(e) => setShowPolicy(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <label htmlFor="policy_enabled" className="block text-sm font-medium text-gray-700 cursor-pointer">
            Link Charging & Remissions Policy
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            Shown to parents on the payment page.
          </p>
          {showPolicy && (
            <input
              name="policy_url"
              type="url"
              placeholder="https://school.example.com/policies/charging.pdf"
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>
    </div>
  );
}
