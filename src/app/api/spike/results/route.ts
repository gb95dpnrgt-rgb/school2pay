import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }

  // List recent payment intents on the connected account
  const paymentIntents = await stripe.paymentIntents.list(
    { limit: 10, expand: ["data.latest_charge"] },
    { stripeAccount: accountId }
  );

  const rows = paymentIntents.data.map((pi) => {
    const charge =
      pi.latest_charge && typeof pi.latest_charge !== "string"
        ? pi.latest_charge
        : null;
    const grossPence = pi.amount;
    const appFeePence =
      charge?.application_fee_amount ?? null;
    const stripeFeesPence =
      charge?.balance_transaction &&
      typeof charge.balance_transaction !== "string"
        ? charge.balance_transaction.fee
        : null;
    const netToConnectedPence =
      grossPence != null && appFeePence != null && stripeFeesPence != null
        ? grossPence - appFeePence - stripeFeesPence
        : null;

    return {
      id: pi.id,
      status: pi.status,
      grossPence,
      grossFormatted: `£${(grossPence / 100).toFixed(2)}`,
      appFeePence,
      appFeeFormatted: appFeePence != null ? `£${(appFeePence / 100).toFixed(2)}` : "—",
      stripeFeesPence,
      stripeFeesFormatted:
        stripeFeesPence != null ? `£${(stripeFeesPence / 100).toFixed(2)}` : "pending",
      netToConnectedPence,
      netToConnectedFormatted:
        netToConnectedPence != null
          ? `£${(netToConnectedPence / 100).toFixed(2)}`
          : "pending",
      created: new Date(pi.created * 1000).toISOString(),
    };
  });

  return NextResponse.json({ accountId, payments: rows });
}
