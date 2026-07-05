import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://school2pay.vercel.app";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { schoolId: string; email: string; studentId: string | null; lines: Array<{ itemId: string; quantity: number }> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { schoolId, email, studentId, lines } = body;
  if (!email || !lines?.length) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = getAdmin();

  // Fetch items and verify they belong to this school and are active
  const itemIds = lines.map((l) => l.itemId);
  const { data: items } = await (admin.from("shop_items") as any)
    .select("id, name, price_pence, stock, active")
    .eq("school_id", schoolId)
    .in("id", itemIds) as { data: Array<{ id: string; name: string; price_pence: number; stock: number | null; active: boolean }> | null };

  if (!items?.length) return NextResponse.json({ error: "Items not found" }, { status: 404 });

  const itemMap = new Map(items.map((i) => [i.id, i]));

  // Validate each line
  for (const line of lines) {
    const item = itemMap.get(line.itemId);
    if (!item || !item.active) return NextResponse.json({ error: `Item not available` }, { status: 400 });
    if (item.stock !== null && item.stock < line.quantity) return NextResponse.json({ error: `${item.name} is out of stock` }, { status: 400 });
  }

  // Find or create guardian
  let { data: guardian } = await admin.from("guardians").select("id").eq("email", email.toLowerCase().trim()).maybeSingle() as { data: { id: string } | null };
  if (!guardian) {
    const { data: created } = await admin.from("guardians").insert({ email: email.toLowerCase().trim() }).select("id").single() as { data: { id: string } | null };
    guardian = created;
  }
  if (!guardian) return NextResponse.json({ error: "Failed to create account" }, { status: 500 });

  const total = lines.reduce((s, l) => s + itemMap.get(l.itemId)!.price_pence * l.quantity, 0);

  // Fetch trust stripe_account_id
  const { data: school } = await admin.from("schools").select("trust_id, trusts(stripe_account_id), name").eq("id", schoolId).single() as {
    data: { trust_id: string; name: string; trusts: { stripe_account_id: string | null } | null } | null
  };
  const stripeAccountId = (school?.trusts as any)?.stripe_account_id as string | null;

  // Create order (pending)
  const { data: order } = await (admin.from("shop_orders") as any)
    .insert({ school_id: schoolId, guardian_id: guardian.id, student_id: studentId || null, status: "pending", total_pence: total })
    .select("id").single() as { data: { id: string } | null };

  if (!order) return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

  // Create order lines
  await (admin.from("shop_order_lines") as any).insert(
    lines.map((l) => ({
      order_id: order.id,
      item_id: l.itemId,
      quantity: l.quantity,
      unit_price_pence: itemMap.get(l.itemId)!.price_pence,
    }))
  );

  // Stripe Checkout
  const successUrl = `${APP_URL}/shop/browse/${schoolId}?success=1`;
  const cancelUrl = `${APP_URL}/shop/browse/${schoolId}`;

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "payment",
    customer_email: email,
    line_items: lines.map((l) => ({
      price_data: {
        currency: "gbp",
        product_data: { name: `${itemMap.get(l.itemId)!.name} — ${school?.name ?? "School"}` },
        unit_amount: itemMap.get(l.itemId)!.price_pence,
      },
      quantity: l.quantity,
    })),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { type: "shop_order", order_id: order.id, school_id: schoolId },
  };

  if (stripeAccountId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: 50,
      transfer_data: { destination: stripeAccountId },
    };
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    await (admin.from("shop_orders") as any).update({ status: "cancelled" }).eq("id", order.id);
    return NextResponse.json({ error: "Payment session could not be created" }, { status: 502 });
  }

  await (admin.from("shop_orders") as any)
    .update({ stripe_checkout_session: session.id })
    .eq("id", order.id);

  return NextResponse.json({ url: session.url });
}
