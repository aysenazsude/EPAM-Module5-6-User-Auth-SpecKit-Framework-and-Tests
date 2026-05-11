import jwt, { type JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../config/db';

/** JWT lifetime in seconds (24 hours per FR-008). */
export const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export interface SignedToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export interface AppJwtPayload extends JwtPayload {
  sub: string;
  jti: string;
  exp: number;
  iat: number;
}

/**
 * Signs a JWT for the given user with a fresh `jti`.
 * Returns the encoded token, its `jti`, and the absolute expiry instant.
 */
export function signToken(userId: string): SignedToken {
  const jti = randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_TTL_SECONDS;
  const token = jwt.sign(
    { sub: userId, jti, iat, exp },
    env().JWT_SECRET,
    { algorithm: 'HS256' }
  );
  return { token, jti, expiresAt: new Date(exp * 1000) };
}

/**
 * Verifies and decodes a JWT.
 * Throws if the token is expired, tampered with, or otherwise invalid.
 */
export function verifyToken(token: string): AppJwtPayload {
  const decoded = jwt.verify(token, env().JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }
  const payload = decoded as JwtPayload;
  if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string' || typeof payload.exp !== 'number') {
    throw new Error('Invalid token claims');
  }
  return payload as AppJwtPayload;
}

/**
 * Deletes RevokedToken rows whose `expires_at` is in the past.
 * Safe to call on startup; expired tokens fail JWT verification first regardless.
 */
export async function deleteExpiredRevokedTokens(): Promise<number> {
  const result = await prisma.revokedToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/**
 * Deletes PasswordResetToken rows whose `expires_at` is in the past.
 */
export async function deleteExpiredPasswordResetTokens(): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
