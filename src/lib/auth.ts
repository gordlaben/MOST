import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.TRAKT_CLIENT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET (or TRAKT_CLIENT_SECRET as fallback) must be set');
  }
  return new TextEncoder().encode(secret);
}

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
    .setExpirationTime('30d')
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<{ profileId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.profileId !== 'string') return null;
    return { profileId: payload.profileId };
  } catch {
    return null;
  }
}
