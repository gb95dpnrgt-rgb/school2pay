import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { verifyDinnerToken } from "@/lib/dinner-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { token: string; amountPence: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, amountPence } = body;

  if (!Number.isInteger(amountPence) || amountPence < 500) {
    return NextResponse.json({ error: "Minimum top-up is £5.00" }, { status: 400 });
  }

  let guardianId: string;
  let schoolId: string;
  try {
    const payload = await verifyDinnerToken(decodeURIComponent(token));
    guardianId = payload.guardianId;
    schoolId = payload.schoolId;
  } catch {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 403 });
  }

  const admin = getAdmin();

  // Verify guardian exists
  const { data: guardian } = await admin
    .from("guardians")
    .select("id, email")
    .eq("id", guardianId)
    .single() as { data: { id: string; email: string } | null };

  if (!guardian) return NextResponse.json({ error: "Guardian not found" }, { status: 404 });

  // Fetch school name + trust stripe_account_id
  const { data: school } = await admin
    .from("schools")
    .select("id, name, trust_id, trusts(stripe_account_id)")
    .eq("id", schoolId)
    .single() as {
      data: { id: string; name: string; trust_id: string; trusts: { stripe_account_id: string | null } | null } | null
    };

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const stripeAccountId = (school.trusts as any)?.stripe_account_id as string | null;

  // Get or create wallet
  let { data: wallet } = await (admin.from("dinner_wallets") as any)
    .select("id, balance_pence")
    .eq("guardian_id", guardianId)
    .eq("school_id", schoolId)
    .single() as { data: { id: string; balance_pence: number } | null };

  if (!wallet) {
    const { data: created } = await (admin.from("dinner_wallets") as any)
      .insert({ guardian_id: guardianId, school_id: schoolId, balance_pence: 0 })
      .select("id, balance_pence")
      .single();
    wallet = created;
  }

  if (!wallet) return NextResponse.json({ error: "Failed to get wallet" }, { status: 500 });

  const encodedToken = encodeURIComponent(token);
  const successUrl = `${APP_URL}/pay/dinner/${encodedToken}?topup=success`;
  const cancelUrl = `${APP_URL}/pay/dinner/${encodedToken}`;

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "payment",
    customer_email: guardian.email,
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: { name: `Dinner money top-up — ${school.name}` },
          unit_amount: amountPence,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "dinner_topup",
      guardian_id: guardianId,
      school_id: schoolId,
      wallet_id: wallet.id,
    },
  };

  // No application fee on dinner top-ups — school gets full amount
  if (stripeAccountId) {
    sessionParams.payment_intent_data = {
      transfer_data: { destination: stripeAccountId },
    };
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    console.error("[dinner/topup] Stripe session creation failed:", err);
    return NextResponse.json({ error: "Payment session could not be created" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
