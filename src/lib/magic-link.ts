import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const ALG = "HS256";
const TTL_SECONDS = 7 * 24 * 60 * 60;

function getSecret() {
  const raw = process.env.MAGIC_LINK_SECRET;
  if (!raw) throw new Error("MAGIC_LINK_SECRET is not set");
  return new TextEncoder().encode(raw);
}

export interface MagicLinkPayload extends JWTPayload {
  guardianId: string;
  paymentRequestId: string;
}

export async function signMagicToken(guardianId: string, paymentRequestId: string): Promise<string> {
  return new SignJWT({ guardianId, paymentRequestId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyMagicToken(token: string): Promise<MagicLinkPayload> {
  const { payload } = await jwtVerify<MagicLinkPayload>(token, getSecret(), { algorithms: [ALG] });
  if (!payload.guardianId || !payload.paymentRequestId) {
    throw new Error("Invalid token payload");
  }
  return payload;
}
