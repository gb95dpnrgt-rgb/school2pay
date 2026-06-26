"use client";

import { useState, useEffect, useId } from "react";
import {
  estimateNetPence,
  grossUpToNet,
  feeBreakdown,
  formatPence,
  APPLICATION_FEE_PENCE,
  STRIPE_FIXED_PENCE,
  STRIPE_PERCENT,
} from "@/lib/fees";

interface Props {
  studentCount: number;
}

export default function FeeCalculator({ studentCount }: Props) {
  const netId = useId();
  const [chargePence, setChargePence] = useState<number | null>(null);
  const [rawAmount, setRawAmount] = useState("");
  const [netTargetRaw, setNetTargetRaw] = useState("");
  const [showNetInput, setShowNetInput] = useState(false);

  function parseAmountInput(val: string): number | null {
    const n = parseFloat(val.replace(/[£,]/g, ""));
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n * 100);
  }

  useEffect(() => {
    const pence = parseAmountInput(rawAmount);
    setChargePence(pence);
  }, [rawAmount]);

  function handleGrossUp() {
    const netPence = parseAmountInput(netTargetRaw);
    if (!netPence) return;
    const charge = grossUpToNet(netPence);
    const chargeStr = (charge / 100).toFixed(2);
    setRawAmount(chargeStr);
    setChargePence(charge);
    setShowNetInput(false);
    setNetTargetRaw("");
    // Sync the hidden form field
    const hiddenInput = document.getElementById("amount_pence_hidden") as HTMLInputElement | null;
    if (hiddenInput) hiddenInput.value = String(charge);
  }

  const breakdown = chargePence && chargePence > 0 ? feeBreakdown(chargePence) : null;

  return (
    <div className="space-y-4">
      {/* Amount input — visible, syncs a hidden pence field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Amount parents pay (gross)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">£</span>
          <input
            type="number"
            name="_amount_display"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={rawAmount}
            onChange={(e) => {
              setRawAmount(e.target.value);
              const pence = parseAmountInput(e.target.value);
              const hiddenInput = document.getElementById("amount_pence_hidden") as HTMLInputElement | null;
              if (hiddenInput) hiddenInput.value = pence ? String(pence) : "";
            }}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <input type="hidden" id="amount_pence_hidden" name="amount_pence" />
      </div>

      {/* Fee breakdown panel */}
      {breakdown && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Parents pay (gross)</span>
            <span className="font-semibold text-gray-900">{formatPence(breakdown.chargePence)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>
              Card processing ({(STRIPE_PERCENT * 100).toFixed(1)}% + {formatPence(STRIPE_FIXED_PENCE)})
            </span>
            <span>−{formatPence(Math.ceil(breakdown.chargePence * STRIPE_PERCENT) + STRIPE_FIXED_PENCE)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>School2Pay fee (flat)</span>
            <span>−{formatPence(APPLICATION_FEE_PENCE)}</span>
          </div>
          <div className="flex justify-between border-t border-blue-200 pt-2 font-semibold">
            <span className="text-gray-700">~Your school receives (net)</span>
            <span className={breakdown.netPence >= 0 ? "text-green-700" : "text-red-600"}>
              ~{formatPence(Math.max(0, breakdown.netPence))}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 pt-0.5">
            <span>Fees per payment</span>
            <span>{formatPence(breakdown.stripeFee + APPLICATION_FEE_PENCE)} total</span>
          </div>

          {studentCount > 0 && (
            <div className="border-t border-blue-200 pt-2 text-xs text-gray-500 space-y-0.5">
              <div className="flex justify-between font-medium text-gray-700">
                <span>{studentCount} pupils × {formatPence(breakdown.chargePence)} gross</span>
                <span>= {formatPence(breakdown.chargePence * studentCount)} charged</span>
              </div>
              <div className="flex justify-between">
                <span>~Net to your bank ({studentCount} payments)</span>
                <span>~{formatPence(Math.max(0, breakdown.netPence) * studentCount)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gross-up toggle */}
      <div>
        {!showNetInput ? (
          <button
            type="button"
            onClick={() => setShowNetInput(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Set price so we receive £___
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 whitespace-nowrap">We receive £</span>
            <div className="relative">
              <input
                id={netId}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="25.00"
                value={netTargetRaw}
                onChange={(e) => setNetTargetRaw(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGrossUp(); } }}
                className="w-28 px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleGrossUp}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              Calculate
            </button>
            <button
              type="button"
              onClick={() => { setShowNetInput(false); setNetTargetRaw(""); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
