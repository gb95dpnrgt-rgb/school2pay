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
    .select("id, trust_id, trusts!schools_trust_id_fkey(id, legal_name, stripe_account_id)")
    .single();

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const trust = Array.isArray(school.trusts) ? school.trusts[0] : school.trusts;
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const admin = getAdminClient();
  let stripeAccountId = trust.stripe_account_id;

  if (!stripeAccountId) {
    // Create a Stripe Express account — hosted onboarding, Stripe collects KYC
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "company",
      business_profile: {
        mcc: "8299", // Educational services
        product_description: "School payment collections for trips, clubs, and activities",
      },
      settings: {
        payouts: {
          schedule: { interval: "weekly", weekly_anchor: "friday" },
        },
      },
      metadata: {
        trust_id: trust.id,
        school_id: school.id,
        platform: "school2pay",
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

  const base = baseUrl();

  // Generate a hosted onboarding link (expires after 5 minutes — refresh URL handles expiry)
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${base}/onboarding/stripe-refresh`,
    return_url: `${base}/onboarding/stripe-return`,
    type: "account_onboarding",
    collect: "eventually_due",
  });

  return NextResponse.json({ url: accountLink.url });
}
