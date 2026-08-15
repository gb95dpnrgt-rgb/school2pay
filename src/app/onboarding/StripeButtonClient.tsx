"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StripeButtonClient({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/stripe-link", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to start Stripe setup");
      // Extract path from URL to keep Next.js client-side navigation (preserves session cookies)
      const path = data.url.startsWith("http") ? new URL(data.url).pathname : data.url;
      router.push(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Redirecting to Stripe…" : label}
      </button>
    </div>
  );
}
