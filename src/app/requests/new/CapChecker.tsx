"use client";

import { useState } from "react";

export default function CapChecker() {
  const [totalCost, setTotalCost] = useState("");
  const [participants, setParticipants] = useState("");
  const [perPupil, setPerPupil] = useState("");

  const totalCostPence = Math.round(parseFloat(totalCost) * 100) || 0;
  const participantsNum = parseInt(participants, 10) || 0;
  const perPupilPence = Math.round(parseFloat(perPupil) * 100) || 0;

  const maxPerPupilPence = participantsNum > 0 && totalCostPence > 0
    ? Math.floor(totalCostPence / participantsNum)
    : null;

  const overCap = maxPerPupilPence !== null && perPupilPence > maxPerPupilPence;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total supplier cost <span className="text-gray-400 font-normal">(optional — for cap check)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Enter the actual trip cost. We&apos;ll warn if the per-pupil charge would exceed cost ÷ participants (Education Act 1996 s.455).
          </p>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">£</span>
              <input
                name="total_cost_pounds"
                type="number"
                min="0"
                step="0.01"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="e.g. 4500.00"
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">total cost</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="30"
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">participants</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={perPupil}
                onChange={(e) => setPerPupil(e.target.value)}
                placeholder="per-pupil charge"
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">per pupil</span>
            </div>
          </div>

          {maxPerPupilPence !== null && (
            <div className={`mt-3 rounded-lg px-4 py-3 text-xs ${overCap ? "bg-red-50 border border-red-300 text-red-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
              {overCap ? (
                <>
                  <p className="font-semibold">⚠ Per-pupil charge exceeds cost cap</p>
                  <p className="mt-0.5">
                    Maximum allowed: <strong>£{(maxPerPupilPence / 100).toFixed(2)}</strong> per pupil
                    (£{(totalCostPence / 100).toFixed(2)} ÷ {participantsNum} participants).
                    Charging more than actual cost is not permitted under the Education Act 1996 s.455.
                  </p>
                </>
              ) : (
                <p>
                  ✓ Per-pupil charge is within the cap (max £{(maxPerPupilPence / 100).toFixed(2)}).
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
