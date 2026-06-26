import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  // Custom account — platform collects requirements, no Stripe-hosted onboarding needed.
  // For production we'd use Express; Custom is fine for this spike.
  const account = await stripe.accounts.create({
    controller: {
      stripe_dashboard: { type: "none" },    // Custom: no Stripe dashboard for the school
      fees: { payer: "application" },
      losses: { payments: "application" },
      requirement_collection: "application", // Platform collects, not Stripe
    },
    country: "GB",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    business_profile: {
      name: "Fake Academy Trust (Test)",
      mcc: "8299",
      product_description: "School payments platform",
      url: "https://school2pay.example",
    },
    individual: {
      first_name: "Test",
      last_name: "School",
      email: "test@school2pay.example",
      dob: { day: 1, month: 1, year: 1990 },
      address: {
        line1: "123 Test Street",
        city: "London",
        postal_code: "EC1A 1BB",
        country: "GB",
      },
      phone: "+447400123456",
      // Stripe test magic value: triggers instant verification pass
      id_number: "000000000",
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: "127.0.0.1",
    },
  });

  // Add test bank account for payouts
  await stripe.accounts.createExternalAccount(account.id, {
    external_account: {
      object: "bank_account",
      country: "GB",
      currency: "gbp",
      routing_number: "108800",
      account_number: "00012345",
    },
  });

  return NextResponse.json({
    accountId: account.id,
    configured: true,
    message: "Custom test account fully configured.",
  });
}
