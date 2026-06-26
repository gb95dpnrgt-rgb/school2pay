import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import type { Database } from "@/lib/supabase/types";

function getAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function baseUrl() {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: school } = await supabase
    .from("schools")
    .select("id, trust_id, trusts!schools_trust_id_fkey(id, stripe_account_id)")
    .single();

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const trust = Array.isArray(school.trusts) ? school.trusts[0] : school.trusts;
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const admin = getAdminClient();
  let stripeAccountId = trust.stripe_account_id;

  if (!stripeAccountId) {
    // Custom account — platform collects requirements, no Stripe-hosted onboarding required.
    // In production this would be Express with hosted onboarding; Custom is used here because
    // Express UK accounts cannot complete test-mode identity verification without document upload.
    const account = await stripe.accounts.create({
      controller: {
        stripe_dashboard: { type: "none" },
        fees: { payer: "application" },
        losses: { payments: "application" },
        requirement_collection: "application",
      },
      country: "GB",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        name: "School2Pay School",
        mcc: "8299",
        product_description: "School payments platform",
        url: "https://school2pay.example",
      },
      individual: {
        first_name: "Test",
        last_name: "Admin",
        email: user.email ?? "test@school2pay.example",
        phone: "+447400123456",
        dob: { day: 1, month: 1, year: 1990 },
        address: {
          line1: "123 Test Street",
          city: "London",
          postal_code: "EC1A 1BB",
          country: "GB",
        },
        // Magic value: triggers instant verification pass in Stripe test mode
        id_number: "000000000",
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: "127.0.0.1",
      },
    });

    // Add a test bank account for payouts
    await stripe.accounts.createExternalAccount(account.id, {
      external_account: {
        object: "bank_account",
        country: "GB",
        currency: "gbp",
        routing_number: "108800",
        account_number: "00012345",
      },
    });

    stripeAccountId = account.id;

    const { error } = await admin
      .from("trusts")
      .update({ stripe_account_id: stripeAccountId })
      .eq("id", trust.id);

    if (error) {
      return NextResponse.json({ error: "Failed to save Stripe account" }, { status: 500 });
    }
  }

  // For Custom accounts there is no hosted onboarding — redirect straight to dashboard.
  // If the account somehow still has outstanding requirements, the dashboard will surface them.
  const base = baseUrl();
  return NextResponse.json({ url: `${base}/dashboard` });
}
