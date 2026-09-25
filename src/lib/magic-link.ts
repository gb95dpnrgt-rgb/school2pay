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

export interface HistoryTokenPayload extends JWTPayload {
  guardianId: string;
}

// Long-lived (30 day) guardian-scoped token for the payment history page.
// Does NOT grant access to any specific payment request or Stripe checkout.
export async function signHistoryToken(guardianId: string): Promise<string> {
  return new SignJWT({ guardianId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyHistoryToken(token: string): Promise<HistoryTokenPayload> {
  const { payload } = await jwtVerify<HistoryTokenPayload>(token, getSecret(), { algorithms: [ALG] });
  if (!payload.guardianId) throw new Error("Invalid history token");
  return payload;
}
