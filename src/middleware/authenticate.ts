import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { verifyToken } from '../shared/token/jwt.util';
import { prisma } from '../config/db';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        jti: string;
        exp: number;
      };
    }
  }
}

/**
 * Verifies the Bearer JWT and attaches `req.user`.
 * Rejects revoked tokens (denylist via RevokedToken table).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid authorization header', 401, 'UNAUTHORIZED');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new AppError('Missing token', 401, 'UNAUTHORIZED');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }

    const revoked = await prisma.revokedToken.findUnique({ where: { jti: payload.jti } });
    if (revoked) {
      throw new AppError('Token has been revoked', 401, 'UNAUTHORIZED');
    }

    req.user = { userId: payload.sub, jti: payload.jti, exp: payload.exp };
    next();
  } catch (err) {
    next(err);
  }
}
