import { redirect } from "next/navigation";

// Stripe redirects here after the user completes (or exits) hosted onboarding.
// The fact of returning does not mean onboarding is complete — we check the
// account's charges_enabled on the dashboard.
export default function StripeReturnPage() {
  redirect("/dashboard");
}
