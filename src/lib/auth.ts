import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(process.env.TRAKT_CLIENT_SECRET || 'fallback-secret-key-do-not-use-in-prod');

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createSessionToken(profileId: string): Promise<string> {
  return await new SignJWT({ profileId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // Long session for convenience
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<{ profileId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return { profileId: payload.profileId as string };
  } catch {
    return null;
  }
}
