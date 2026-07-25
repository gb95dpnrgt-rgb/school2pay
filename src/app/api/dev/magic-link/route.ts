import { NextRequest, NextResponse } from "next/server";
import { signMagicToken } from "@/lib/magic-link";

// Dev-only route to generate test magic links — remove before going live
export async function GET(req: NextRequest) {
  if (process.env.ALLOW_DEV_MAGIC !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  const guardianId = req.nextUrl.searchParams.get("guardianId");
  const paymentRequestId = req.nextUrl.searchParams.get("paymentRequestId");
  if (!guardianId || !paymentRequestId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const token = await signMagicToken(guardianId, paymentRequestId);
  const url = `${req.nextUrl.origin}/pay/${encodeURIComponent(token)}`;
  return NextResponse.json({ url });
}
