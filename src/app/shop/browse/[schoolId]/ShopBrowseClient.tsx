"use client";

import { useState } from "react";

function pence(n: number) { return `£${(n / 100).toFixed(2)}`; }

type Item = { id: string; name: string; description: string | null; price_pence: number; stock: number | null };
type Student = { id: string; first_name: string; year_group: string };

export default function ShopBrowseClient({
  school,
  items,
  students,
  justOrdered,
}: {
  school: { id: string; name: string };
  items: Item[];
  students: Student[];
  justOrdered: boolean;
}) {
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const total = items.reduce((s, item) => s + item.price_pence * (basket[item.id] ?? 0), 0);
  const basketCount = Object.values(basket).reduce((s, q) => s + q, 0);

  function setQty(itemId: string, qty: number) {
    setBasket((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[itemId];
      else next[itemId] = qty;
      return next;
    });
  }

  async function checkout() {
    if (!email || basketCount === 0) return;
    setError("");
    setLoading(true);

    const lines = Object.entries(basket).map(([itemId, quantity]) => ({ itemId, quantity }));

    const res = await fetch("/api/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: school.id, email, studentId: studentId || null, lines }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  if (justOrdered) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-green-200 p-8 max-w-md w-full text-center space-y-3">
          <p className="text-3xl">✓</p>
          <h1 className="text-xl font-bold text-gray-900">Order placed!</h1>
          <p className="text-sm text-gray-600">Thank you — your order from <strong>{school.name}</strong> has been paid. The school will hand items to your child.</p>
          <button onClick={() => window.location.href = window.location.pathname}
            className="mt-2 text-sm text-blue-600 hover:underline">Place another order</button>
        </div>
      </main>
    );
  }

  const byYear = students.reduce<Record<string, Student[]>>((acc, s) => {
    (acc[s.year_group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-gray-500">{school.name}</p>
          <h1 className="text-2xl font-bold text-gray-900">School Shop</h1>
        </div>

        {items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">The school shop is not yet open.</p>
          </div>
        )}

        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => {
            const qty = basket[item.id] ?? 0;
            const outOfStock = item.stock !== null && item.stock <= 0;
            return (
              <div key={item.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 ${outOfStock ? "opacity-50" : ""}`}>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                  <p className="text-sm font-semibold text-blue-700 mt-1">{pence(item.price_pence)}</p>
                  {outOfStock && <p className="text-xs text-red-500 mt-0.5">Out of stock</p>}
                </div>
                {!outOfStock && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setQty(item.id, qty - 1)} disabled={qty === 0}
                      className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 text-lg">−</button>
                    <span className="w-6 text-center text-sm font-medium">{qty}</span>
                    <button onClick={() => setQty(item.id, qty + 1)}
                      className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg">+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Checkout */}
        {basketCount > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Your details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Your email *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Child (optional)</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— select child —</option>
                {Object.keys(byYear).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((year) => (
                  <optgroup key={year} label={year}>
                    {byYear[year].map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{basketCount} item{basketCount !== 1 ? "s" : ""}</p>
                <p className="text-lg font-bold text-gray-900">{pence(total)}</p>
              </div>
              <button onClick={checkout} disabled={loading || !email}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                {loading ? "Redirecting…" : "Pay by card"}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400">Secure payment via Stripe · No booking fees</p>
          </div>
        )}

        <p className="text-xs text-center text-gray-400 pb-4">{school.name} · Powered by School2Pay</p>
      </div>
    </main>
  );
}
