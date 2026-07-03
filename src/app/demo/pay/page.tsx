"use client";

import { useState } from "react";
import Link from "next/link";

const CONSENT_FIELDS = [
  { key: "consent_to_attend", label: "I consent for my child to attend this activity", type: "yes_no", required: true },
  { key: "emergency_contact_name", label: "Emergency contact name", type: "text", required: true },
  { key: "emergency_contact_phone", label: "Emergency contact phone number", type: "text", required: true },
  { key: "medical_conditions", label: "Medical conditions / allergies (or write 'None')", type: "text", required: true },
  { key: "dietary_requirements", label: "Dietary requirements (or write 'None')", type: "text", required: false },
];

export default function DemoPayPage() {
  const [consentDone, setConsentDone] = useState(false);
  const [consentValues, setConsentValues] = useState<Record<string, string>>({});
  const [guardianName, setGuardianName] = useState("");
  const [consentError, setConsentError] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  function submitConsent() {
    for (const f of CONSENT_FIELDS) {
      if (f.required && !consentValues[f.key]?.trim()) {
        setConsentError(`"${f.label}" is required`);
        return;
      }
    }
    if (!guardianName.trim()) {
      setConsentError("Please enter your name to sign");
      return;
    }
    setConsentError(null);
    setConsentDone(true);
  }

  function submitPayment() {
    const cleaned = cardNumber.replace(/\s/g, "");
    if (cleaned !== "4242424242424242") {
      setPayError("Use test card 4242 4242 4242 4242 — this is a demo");
      return;
    }
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaymentDone(true);
    }, 1500);
  }

  if (paymentDone) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900">Payment successful!</h1>
          <p className="text-sm text-gray-500">
            Thank you, {guardianName || "Parent"}. Your payment of <strong>£25.00</strong> for the Year 5 Theatre Trip has been received. A confirmation email has been sent.
          </p>
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Consent and payment both recorded ✓
          </div>
          <Link href="/demo/requests/pr1" className="inline-block text-sm text-blue-600 hover:underline">
            ← Back to admin view
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-500">Oakwood Primary School</p>
          <h1 className="text-2xl font-bold text-gray-900">Year 5 & 6 Theatre Trip</h1>
          <p className="text-sm text-gray-500">Visit to the Lyric Theatre — A Midsummer Night's Dream</p>
          <p className="text-xs text-gray-400">Due 15 September 2026</p>
        </div>

        {/* Consent form */}
        {!consentDone ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Consent required</p>
              <p className="text-sm font-medium text-amber-900">Grace (Year 5) — One-off trip consent</p>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
              <strong>Data notice:</strong> Medical and dietary information is used only to safeguard your child on this trip and will be deleted 1 year after the trip date.
            </div>

            <div className="space-y-4">
              {CONSENT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-800">
                    {f.label}
                    {f.required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {f.type === "yes_no" ? (
                    <div className="flex gap-4">
                      {["Yes", "No"].map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={f.key}
                            value={opt}
                            checked={consentValues[f.key] === opt}
                            onChange={() => setConsentValues((p) => ({ ...p, [f.key]: opt }))}
                            className="accent-blue-600"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      rows={2}
                      value={consentValues[f.key] ?? ""}
                      onChange={(e) => setConsentValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Type here…"
                    />
                  )}
                </div>
              ))}

              <div className="border-t border-amber-200 pt-4 space-y-2">
                <p className="text-xs text-gray-500">By typing your name below you confirm the information is correct and you consent to the trip conditions.</p>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Your full name (electronic signature)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {consentError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{consentError}</div>
              )}

              <button
                type="button"
                onClick={submitConsent}
                className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Submit consent
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            ✓ Consent recorded — signed by {guardianName}
          </div>
        )}

        {/* Payment */}
        {consentDone && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Grace — Year 5 Theatre Trip</p>
                <p className="text-xs text-gray-400">Amount due</p>
              </div>
              <p className="text-xl font-bold text-gray-900">£25.00</p>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
              Demo: use card <code className="font-mono bg-white px-1 rounded">4242 4242 4242 4242</code>, any future date, any CVC
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Card number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expiry</label>
                  <input type="text" placeholder="MM / YY" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">CVC</label>
                  <input type="text" placeholder="123" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {payError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{payError}</div>
            )}

            <button
              type="button"
              onClick={submitPayment}
              disabled={paying}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {paying ? "Processing…" : "Pay £25.00"}
            </button>

            <p className="text-center text-xs text-gray-400">
              Payments processed securely by Stripe. No surcharges.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">This link is personal to you. Do not share it.</p>
      </div>
    </main>
  );
}
