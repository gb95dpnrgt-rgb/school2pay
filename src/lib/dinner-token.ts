import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SECRET = new TextEncoder().encode(process.env.MAGIC_LINK_SECRET!);
const ALG = "HS256";
const TTL_SECONDS = 7 * 24 * 60 * 60;

export interface DinnerTokenPayload extends JWTPayload {
  guardianId: string;
  schoolId: string;
}

export async function signDinnerToken(guardianId: string, schoolId: string): Promise<string> {
  return new SignJWT({ guardianId, schoolId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifyDinnerToken(token: string): Promise<DinnerTokenPayload> {
  const { payload } = await jwtVerify<DinnerTokenPayload>(token, SECRET, { algorithms: [ALG] });
  if (!payload.guardianId || !payload.schoolId) throw new Error("Invalid token payload");
  return payload;
}
