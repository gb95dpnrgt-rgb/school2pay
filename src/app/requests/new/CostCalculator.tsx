"use client";

import { useState } from "react";

export default function CostCalculator() {
  const [supplierCost, setSupplierCost] = useState("");
  const [coachCost, setCoachCost] = useState("");
  const [participants, setParticipants] = useState("");
  const [remissions, setRemissions] = useState("");

  const supplier = parseFloat(supplierCost) || 0;
  const coach = parseFloat(coachCost) || 0;
  const n = parseInt(participants) || 0;
  const remissionPct = parseFloat(remissions) || 0;

  const totalCost = supplier + coach;
  const costPerPupil = n > 0 ? totalCost / n : 0;
  // Gross-up for 50p S2P fee + ~1.5% + 20p Stripe fee (per CLAUDE.md formula)
  const S2P_FEE = 0.50;
  const STRIPE_FIXED = 0.20;
  const STRIPE_PCT = 0.015;
  const netTarget = costPerPupil * (1 + remissionPct / 100);
  const grossPerPupil = n > 0
    ? Math.ceil(((netTarget + S2P_FEE + STRIPE_FIXED) / (1 - STRIPE_PCT)) * 100) / 100
    : 0;

  const showCalc = n > 0 && totalCost > 0;

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-4">
      <p className="text-sm font-semibold text-purple-900">Cost calculator</p>
      <p className="text-xs text-purple-700">
        Estimate the per-pupil charge needed to cover supplier costs, after remissions.
        Gross-up includes Stripe fees and the School2Pay platform fee.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Supplier cost (£)</label>
          <input
            type="number" min="0" step="0.01" placeholder="e.g. 2500"
            value={supplierCost}
            onChange={(e) => setSupplierCost(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Coach / transport (£)</label>
          <input
            type="number" min="0" step="0.01" placeholder="e.g. 400"
            value={coachCost}
            onChange={(e) => setCoachCost(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Participants</label>
          <input
            type="number" min="1" step="1" placeholder="e.g. 30"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Remission budget (%)</label>
          <input
            type="number" min="0" max="50" step="0.5" placeholder="e.g. 10"
            value={remissions}
            onChange={(e) => setRemissions(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {showCalc && (
        <div className="rounded-lg bg-white border border-purple-200 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Total supplier cost</span>
            <span className="font-mono">£{totalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Net per pupil (before remissions)</span>
            <span className="font-mono">£{costPerPupil.toFixed(2)}</span>
          </div>
          {remissionPct > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Net per pupil (with {remissionPct}% remission uplift)</span>
              <span className="font-mono">£{netTarget.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-1.5 font-semibold text-purple-900">
            <span>Recommended charge (gross)</span>
            <span className="font-mono">£{grossPerPupil.toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-400 pt-1">
            Includes ~1.5% + 20p Stripe fee and 50p School2Pay fee.
            Enter this as the amount above.
          </p>
        </div>
      )}
    </div>
  );
}
