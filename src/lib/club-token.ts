import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SECRET = new TextEncoder().encode(process.env.MAGIC_LINK_SECRET!);
const ALG = "HS256";

export interface ClubTokenPayload extends JWTPayload {
  clubId: string;
  schoolId: string;
}

export async function signClubToken(clubId: string, schoolId: string): Promise<string> {
  return new SignJWT({ clubId, schoolId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(SECRET);
}

export async function verifyClubToken(token: string): Promise<ClubTokenPayload> {
  const { payload } = await jwtVerify<ClubTokenPayload>(token, SECRET, { algorithms: [ALG] });
  if (!payload.clubId || !payload.schoolId) throw new Error("Invalid token payload");
  return payload;
}
