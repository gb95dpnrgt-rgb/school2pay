import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Fee model (TEST MODE — see DECISIONS.md)
// Net target: 2500p (£25.00)
// Platform application fee: 50p flat
// Stripe processing fee (UK consumer card): ~1.5% + 20p
// Gross-up so connected account nets £25.00 after all fees:
//   charge = ceil((net + fixed) / (1 - pct))
//   charge = ceil((2500 + 20 + 50) / (1 - 0.015))  ← fixed = Stripe 20p + our 50p
//          = ceil(2570 / 0.985) = ceil(2608.63) = 2609p
// The connected account receives: 2609 - Stripe fee - 50p app fee ≈ 2500p
// We collect: 50p application fee
const NET_PENCE = 2500;
const STRIPE_FIXED_PENCE = 20;
const STRIPE_PCT = 0.015;
const APP_FEE_PENCE = 50;
const CHARGE_PENCE = Math.ceil(
  (NET_PENCE + STRIPE_FIXED_PENCE + APP_FEE_PENCE) / (1 - STRIPE_PCT)
);

export async function POST(req: NextRequest) {
  const { accountId } = (await req.json()) as { accountId: string };
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: CHARGE_PENCE,
            product_data: { name: "School Trip — Year 6 (Test)" },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: APP_FEE_PENCE,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/spike?paid=1&account_id=${accountId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/spike?cancelled=1`,
    },
    { stripeAccount: accountId }
  );

  return NextResponse.json({ url: session.url, chargePence: CHARGE_PENCE });
}
