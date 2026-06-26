"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

type Payment = {
  id: string;
  status: string;
  grossFormatted: string;
  appFeeFormatted: string;
  stripeFeesFormatted: string;
  netToConnectedFormatted: string;
  created: string;
};

export default function SpikePage() {
  // Block in production unless explicitly enabled
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_SPIKE !== "true"
  ) {
    return (
      <main className="p-8 font-mono">
        <h1 className="text-red-600 font-bold">Not available in production.</h1>
      </main>
    );
  }

  const params = useSearchParams();
  const [accountId, setAccountId] = useState<string>(
    params.get("account_id") ?? ""
  );
  const [log, setLog] = useState<string[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const msgs: string[] = [];
    if (params.get("onboarded")) msgs.push("✅ Onboarding complete.");
    if (params.get("paid")) msgs.push("✅ Payment succeeded (webhook will confirm).");
    if (params.get("cancelled")) msgs.push("⚠️ Payment cancelled.");
    if (params.get("error")) msgs.push(`❌ Error: ${params.get("error")}`);
    if (msgs.length) setLog((l) => [...msgs, ...l]);
  }, [params]);

  function addLog(msg: string) {
    setLog((l) => [`${new Date().toISOString()} — ${msg}`, ...l]);
  }

  async function createAccount() {
    setLoading(true);
    try {
      const res = await fetch("/api/spike/create-account", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "unknown error");
      setAccountId(data.accountId);
      addLog(`Created account ${data.accountId}. Redirecting to onboarding…`);
      window.location.href = data.onboardingUrl;
    } catch (e) {
      addLog(`❌ Create account failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function takePayment() {
    if (!accountId) {
      addLog("❌ No account ID. Create a test trust account first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/spike/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "unknown error");
      addLog(
        `Checkout created — gross charge: £${(data.chargePence / 100).toFixed(2)}. Redirecting…`
      );
      window.location.href = data.url;
    } catch (e) {
      addLog(`❌ Checkout failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function showResults() {
    if (!accountId) {
      addLog("❌ No account ID.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/spike/results?account_id=${encodeURIComponent(accountId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "unknown error");
      setPayments(data.payments ?? []);
      addLog(`Loaded ${data.payments.length} payment(s) for ${accountId}.`);
    } catch (e) {
      addLog(`❌ Results failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8 font-mono">
      <h1 className="text-2xl font-bold mb-1">Stripe Connect Spike</h1>
      <p className="text-sm text-red-600 mb-6">
        ⚠️ TEST MODE ONLY — never expose to parents
      </p>

      <div className="mb-4">
        <label className="block text-xs mb-1 font-bold">Connected account ID</label>
        <input
          className="w-full border px-2 py-1 text-sm"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="acct_…"
        />
      </div>

      <div className="flex gap-3 mb-8">
        <button
          onClick={createAccount}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          1. Create test trust account
        </button>
        <button
          onClick={takePayment}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          2. Take test payment (£25)
        </button>
        <button
          onClick={showResults}
          disabled={loading}
          className="bg-gray-700 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          3. Show results
        </button>
      </div>

      {payments.length > 0 && (
        <div className="mb-8 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">Status</th>
                <th className="border px-2 py-1 text-right">Gross (parent pays)</th>
                <th className="border px-2 py-1 text-right">Stripe fees</th>
                <th className="border px-2 py-1 text-right">Our fee</th>
                <th className="border px-2 py-1 text-right">Net → school</th>
                <th className="border px-2 py-1 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="border px-2 py-1">{p.status}</td>
                  <td className="border px-2 py-1 text-right font-bold">
                    {p.grossFormatted}
                  </td>
                  <td className="border px-2 py-1 text-right text-red-700">
                    {p.stripeFeesFormatted}
                  </td>
                  <td className="border px-2 py-1 text-right text-blue-700">
                    {p.appFeeFormatted}
                  </td>
                  <td className="border px-2 py-1 text-right text-green-700">
                    {p.netToConnectedFormatted}
                  </td>
                  <td className="border px-2 py-1 text-gray-500">
                    {new Date(p.created).toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-gray-900 text-green-400 p-4 h-48 overflow-y-auto text-xs">
        {log.length === 0 && <span className="text-gray-500">Log output will appear here…</span>}
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </main>
  );
}
