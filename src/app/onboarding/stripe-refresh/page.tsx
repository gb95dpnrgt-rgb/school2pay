"use client";

import { useEffect } from "react";

// Stripe calls this URL if the account link expired before the user completed onboarding.
// We immediately request a new link and redirect.
export default function StripeRefreshPage() {
  useEffect(() => {
    fetch("/api/onboarding/stripe-link", { method: "POST" })
      .then((r) => r.json())
      .then(({ url }) => {
        if (url) window.location.href = url;
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Resuming payments setup…</p>
    </main>
  );
}
