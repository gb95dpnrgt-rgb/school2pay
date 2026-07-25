import { NextRequest, NextResponse } from "next/server";
import { signMagicToken, verifyMagicToken } from "@/lib/magic-link";

// Dev-only route to generate test magic links — remove before going live
export async function GET(req: NextRequest) {
  const guardianId = req.nextUrl.searchParams.get("guardianId");
  const paymentRequestId = req.nextUrl.searchParams.get("paymentRequestId");
  if (!guardianId || !paymentRequestId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const token = await signMagicToken(guardianId, paymentRequestId);
  // Immediately verify to confirm secret is consistent
  try {
    await verifyMagicToken(token);
  } catch (e: any) {
    return NextResponse.json({ error: "Verify failed immediately after sign", detail: e?.message, secretPrefix: process.env.MAGIC_LINK_SECRET?.slice(0, 8) }, { status: 500 });
  }
  const url = `${req.nextUrl.origin}/pay/${encodeURIComponent(token)}`;
  return NextResponse.json({ url, secretPrefix: process.env.MAGIC_LINK_SECRET?.slice(0, 8) });
}
