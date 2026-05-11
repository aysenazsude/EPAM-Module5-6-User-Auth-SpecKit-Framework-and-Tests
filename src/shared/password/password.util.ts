import bcrypt from 'bcrypt';

const COST = 12;

/**
 * Hashes a plaintext password using bcrypt at cost 12.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 * Returns false on any comparison error (never throws).
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
