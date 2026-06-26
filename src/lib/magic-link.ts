import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const rawSecret = process.env.MAGIC_LINK_SECRET;
if (!rawSecret) {
  throw new Error("MAGIC_LINK_SECRET environment variable is not set");
}
const SECRET = new TextEncoder().encode(rawSecret);

const ALG = "HS256";
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days per CLAUDE.md

export interface MagicLinkPayload extends JWTPayload {
  guardianId: string;
  paymentRequestId: string;
}

export async function signMagicToken(guardianId: string, paymentRequestId: string): Promise<string> {
  return new SignJWT({ guardianId, paymentRequestId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifyMagicToken(token: string): Promise<MagicLinkPayload> {
  const { payload } = await jwtVerify<MagicLinkPayload>(token, SECRET, { algorithms: [ALG] });
  if (!payload.guardianId || !payload.paymentRequestId) {
    throw new Error("Invalid token payload");
  }
  return payload;
}
