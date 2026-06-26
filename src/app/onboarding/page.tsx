import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSchool } from "./actions";
import { stripe } from "@/lib/stripe";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Detect current step from DB state
  const { data: school } = await supabase
    .from("schools")
    .select("id, name, urn, trust_id, trusts!schools_trust_id_fkey(id, legal_name, stripe_account_id)")
    .single();

  // Step 1: no school yet
  if (!school) {
    return <StepSchool error={params.error} />;
  }

  const trust = Array.isArray(school.trusts) ? school.trusts[0] : school.trusts;

  // Step 2: school exists, no Stripe account
  if (!trust?.stripe_account_id) {
    return <StepStripe schoolName={school.name} trustName={trust?.legal_name} error={params.error} />;
  }

  // Step 2 in progress: account created but onboarding not finished
  let chargesEnabled = false;
  let detailsSubmitted = false;
  try {
    const account = await stripe.accounts.retrieve(trust.stripe_account_id);
    chargesEnabled = account.charges_enabled;
    detailsSubmitted = account.details_submitted;
  } catch {
    // account retrieval failed — show resume
  }

  if (chargesEnabled && detailsSubmitted) {
    redirect("/dashboard");
  }

  return (
    <StepStripeResume
      schoolName={school.name}
      trustName={trust?.legal_name}
      detailsSubmitted={detailsSubmitted}
    />
  );
}

// ── Step 1: create trust + school ────────────────────────────────────────────

function StepSchool({ error }: { error?: string }) {
  return (
    <OnboardingShell step={1} title="Tell us about your school">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <form action={createSchool} className="space-y-4">
        <div>
          <label htmlFor="legal_name" className="block text-sm font-medium text-gray-700 mb-1">
            Trust / Academy legal name
          </label>
          <input
            id="legal_name"
            name="legal_name"
            type="text"
            required
            placeholder="Oakwood Multi-Academy Trust"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="school_name" className="block text-sm font-medium text-gray-700 mb-1">
            School name
          </label>
          <input
            id="school_name"
            name="school_name"
            type="text"
            required
            placeholder="Oakwood Primary School"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="urn" className="block text-sm font-medium text-gray-700 mb-1">
            URN{" "}
            <span className="text-gray-400 font-normal">(optional — UK unique reference number)</span>
          </label>
          <input
            id="urn"
            name="urn"
            type="text"
            placeholder="123456"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Continue
        </button>
      </form>
    </OnboardingShell>
  );
}

// ── Step 2: start Stripe onboarding ──────────────────────────────────────────

function StepStripe({
  schoolName,
  trustName,
  error,
}: {
  schoolName?: string;
  trustName?: string;
  error?: string;
}) {
  return (
    <OnboardingShell step={2} title="Set up payments">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{schoolName ?? "Your school"}</span>
          {trustName ? ` · ${trustName}` : ""}
        </p>
        <p className="text-sm text-gray-500">
          School2Pay uses Stripe to collect card payments from parents. We need to verify your trust
          as the merchant of record before you can create payment requests.
        </p>
        <ul className="text-sm text-gray-500 space-y-1 pl-4 list-disc">
          <li>Takes 5–10 minutes</li>
          <li>You&apos;ll need: trust address, bank account details, a representative&apos;s details</li>
          <li>No card fees charged to parents — all fees are netted from payouts (<a href="/fees" className="underline text-blue-600 hover:text-blue-800">see fee schedule</a>)</li>
        </ul>
      </div>
      <StripeStartButton />
    </OnboardingShell>
  );
}

// ── Step 2 (resumed): account exists but onboarding incomplete ────────────────

function StepStripeResume({
  schoolName,
  trustName,
  detailsSubmitted,
}: {
  schoolName?: string;
  trustName?: string;
  detailsSubmitted: boolean;
}) {
  return (
    <OnboardingShell step={2} title="Set up payments">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{schoolName ?? "Your school"}</span>
          {trustName ? ` · ${trustName}` : ""}
        </p>
        {detailsSubmitted ? (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Your details have been submitted. Stripe is reviewing your account — this can take up to
            24 hours. You can still resume to check for outstanding requirements.
          </div>
        ) : (
          <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
            Your Stripe setup is incomplete. Click below to resume where you left off.
          </div>
        )}
      </div>
      <StripeStartButton label="Resume Stripe setup" />
    </OnboardingShell>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function OnboardingShell({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Step {step} of 2
          </p>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

// Client component for the Stripe button (needs fetch + redirect)
function StripeStartButton({ label = "Set up payments with Stripe" }: { label?: string }) {
  return <StripeButtonClient label={label} />;
}

// Inline client component — kept small so the rest of the page stays a server component
import StripeButtonClient from "./StripeButtonClient";
