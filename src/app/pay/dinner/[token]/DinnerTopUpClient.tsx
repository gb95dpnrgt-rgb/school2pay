"use client";

import { useState } from "react";

const PRESET_AMOUNTS = [1000, 2000, 5000]; // £10, £20, £50

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type HistoryRow = {
  type: string;
  amount_pence: number;
  balance_after_pence: number;
  note: string | null;
  date: string;
  created_at: string;
};

export default function DinnerTopUpClient({
  token,
  schoolName,
  guardianEmail,
  balancePence,
  pricePerMealPence,
  history,
  justToppedUp,
}: {
  token: string;
  schoolName: string;
  guardianEmail: string;
  balancePence: number;
  pricePerMealPence: number;
  history: HistoryRow[];
  justToppedUp: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(2000); // default £20
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isNegative = balancePence < 0;
  const mealsRemaining = Math.floor(balancePence / pricePerMealPence);

  const finalAmount = selected === -1
    ? Math.round(parseFloat(custom || "0") * 100)
    : selected ?? 0;

  async function handleTopUp() {
    if (finalAmount < 500) {
      setError("Minimum top-up is £5.00");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/dinner/topup/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amountPence: finalAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-md mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-gray-500">{schoolName}</p>
          <h1 className="text-2xl font-bold text-gray-900">Dinner money</h1>
          <p className="text-sm text-gray-400">{guardianEmail}</p>
        </div>

        {/* Success banner */}
        {justToppedUp && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-center space-y-1">
            <p className="text-2xl">✓</p>
            <p className="font-semibold text-green-800">Top-up successful</p>
            <p className="text-sm text-green-700">Your wallet has been credited — it may take a moment to update.</p>
          </div>
        )}

        {/* Balance card */}
        <div className={`rounded-2xl border p-6 text-center space-y-1 ${isNegative ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current balance</p>
          <p className={`text-4xl font-bold tabular-nums ${isNegative ? "text-red-600" : "text-gray-900"}`}>
            {pence(balancePence)}
          </p>
          {balancePence >= 0 && (
            <p className="text-sm text-gray-500">
              ~{mealsRemaining} meal{mealsRemaining !== 1 ? "s" : ""} remaining at {pence(pricePerMealPence)}/meal
            </p>
          )}
          {isNegative && (
            <p className="text-sm text-red-600 font-medium">Your account is overdrawn — please top up</p>
          )}
        </div>

        {/* Top-up card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Add funds</h2>

          {/* Preset amounts */}
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => { setSelected(amount); setCustom(""); }}
                className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  selected === amount
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                {pence(amount)}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Or enter amount (£)</label>
            <input
              type="number"
              min="5"
              step="0.50"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setSelected(-1); }}
              onFocus={() => setSelected(-1)}
              placeholder="e.g. 30.00"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                selected === -1 ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleTopUp}
            disabled={loading || finalAmount < 500}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {loading ? "Redirecting to payment…" : finalAmount >= 500 ? `Pay ${pence(finalAmount)} by card` : "Select an amount"}
          </button>

          <p className="text-xs text-center text-gray-400">
            Secure payment via Stripe · No card fees charged to you
          </p>
        </div>

        {/* Recent history */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
            <div className="space-y-2">
              {history.map((row, i) => {
                const isCredit = row.amount_pence > 0;
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-800">{row.note ?? row.type}</p>
                      <p className="text-xs text-gray-400">{formatDate(row.date)}</p>
                    </div>
                    <span className={`font-semibold tabular-nums ${isCredit ? "text-green-600" : "text-gray-700"}`}>
                      {isCredit ? "+" : ""}{pence(row.amount_pence)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-gray-400 pb-4">
          {schoolName} · Powered by School2Pay
        </p>
      </div>
    </main>
  );
}
