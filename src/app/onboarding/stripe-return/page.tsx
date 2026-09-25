import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function StripeReturnPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, trusts!schools_trust_id_fkey(id, legal_name, stripe_account_id)")
    .single();

  const trust = school
    ? (Array.isArray(school.trusts) ? school.trusts[0] : school.trusts) as { id: string; legal_name: string; stripe_account_id: string | null } | null
    : null;

  if (!trust?.stripe_account_id) redirect("/onboarding");

  let chargesEnabled = false;
  let detailsSubmitted = false;
  try {
    const account = await stripe.accounts.retrieve(trust.stripe_account_id);
    chargesEnabled = account.charges_enabled;
    detailsSubmitted = account.details_submitted;
  } catch {
    redirect("/onboarding");
  }

  // Send welcome email and mark as live on first successful verification
  if (chargesEnabled) {
    const admin = getAdmin();
    // Mark trust as verified (idempotent — only update if not already set)
    await (admin as any)
      .from("trusts")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", trust.id)
      .is("verified_at", null);

    // Fire welcome email (non-blocking — don't fail the page if email errors)
    try {
      const { sendWelcomeEmail } = await import("@/lib/email");
      await sendWelcomeEmail({
        email: user.email!,
        schoolName: school?.name ?? "",
        trustName: trust.legal_name,
      });
    } catch (e) {
      console.error("Welcome email failed:", e);
    }

    redirect("/dashboard?welcome=1");
  }

  // Not yet enabled — show pending state
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6 text-center">
        <div className="text-4xl">⏳</div>
        <h1 className="text-xl font-bold text-gray-900">Stripe is reviewing your account</h1>
        <p className="text-sm text-gray-500">
          {detailsSubmitted
            ? "Your details have been submitted. Stripe typically completes reviews within a few hours. You'll receive an email when your account is approved."
            : "You haven't finished the Stripe setup yet. Click below to resume."}
        </p>
        {!detailsSubmitted && (
          <a
            href="/onboarding"
            className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Resume setup
          </a>
        )}
        {detailsSubmitted && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Once approved, sign in to start creating payment requests.
            </p>
            <a
              href="/dashboard"
              className="inline-block text-sm text-blue-600 hover:underline"
            >
              Go to dashboard →
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
