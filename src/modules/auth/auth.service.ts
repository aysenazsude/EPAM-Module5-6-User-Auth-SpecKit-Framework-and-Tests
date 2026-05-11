import { createHash, randomBytes } from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { hashPassword, verifyPassword } from '../../shared/password/password.util';
import { signToken } from '../../shared/token/jwt.util';
import type { IEmailService } from '../../shared/email/email.types';
import type { AuthToken } from './auth.types';

/** Rate-limit constants per FR-011. */
export const RATE_LIMIT_MAX_FAILURES = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
/** Reset link lifetime per FR-013. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Prisma "client error" code for unique-constraint violations. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/** Generic auth error message used to prevent enumeration (FR-007). */
const INVALID_CREDENTIALS = 'Invalid credentials';

/** Generic reset error used to prevent enumeration (FR-014–016). */
const INVALID_RESET = 'Reset token is invalid or has expired';

/** Hash a raw reset token using SHA-256 (research §3). */
function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Authentication service: registration, login, logout, password reset.
 * Pure business logic — depends only on injected Prisma client and email service.
 */
export class AuthService {
  constructor(
    private readonly prisma: Pick<PrismaClient, 'user' | 'passwordResetToken' | 'revokedToken' | 'loginAttempt'>,
    private readonly emailService: IEmailService,
    private readonly resetLinkBaseUrl: string = 'http://localhost:3000/auth/password-reset/confirm'
  ) {}

  /**
   * Registers a new user.
   * @throws AppError(409) if email already exists.
   */
  async register(email: string, password: string): Promise<void> {
    const normalised = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (existing) {
      throw new AppError('Email already in use', 409, 'EMAIL_IN_USE');
    }
    const passwordHash = await hashPassword(password);
    try {
      await this.prisma.user.create({ data: { email: normalised, passwordHash } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_VIOLATION) {
        throw new AppError('Email already in use', 409, 'EMAIL_IN_USE');
      }
      throw err;
    }
  }

  /**
   * Authenticates a user and issues a JWT.
   * @throws AppError(401) on any credential failure.
   * @throws AppError(429) if the account is currently rate-limited.
   */
  async login(email: string, password: string): Promise<AuthToken> {
    const normalised = email.toLowerCase().trim();
    await this.assertNotRateLimited(normalised);

    const user = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (!user || user.deletedAt) {
      await this.recordFailedAttempt(normalised);
      throw new AppError(INVALID_CREDENTIALS, 401, 'INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await this.recordFailedAttempt(normalised);
      throw new AppError(INVALID_CREDENTIALS, 401, 'INVALID_CREDENTIALS');
    }

    // Successful login resets the counter.
    await this.prisma.loginAttempt.delete({ where: { key: normalised } }).catch(() => undefined);

    const signed = signToken(user.id);
    return { token: signed.token, expiresAt: signed.expiresAt.toISOString() };
  }

  private async assertNotRateLimited(key: string): Promise<void> {
    const attempt = await this.prisma.loginAttempt.findUnique({ where: { key } });
    if (!attempt) return;
    const now = Date.now();
    if (attempt.count >= RATE_LIMIT_MAX_FAILURES && attempt.resetAt.getTime() > now) {
      const retryAfterSeconds = Math.ceil((attempt.resetAt.getTime() - now) / 1000);
      throw new AppError('Account temporarily locked. Try again later.', 429, 'RATE_LIMITED', {
        retryAfter: retryAfterSeconds,
      });
    }
  }

  private async recordFailedAttempt(key: string): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.loginAttempt.findUnique({ where: { key } });
    if (!existing || existing.resetAt.getTime() <= now.getTime()) {
      await this.prisma.loginAttempt.upsert({
        where: { key },
        create: { key, count: 1, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) },
        update: { count: 1, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) },
      });
      return;
    }
    await this.prisma.loginAttempt.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) },
      update: { count: existing.count + 1 },
    });
  }

  /**
   * Revokes the active session by inserting the JWT's `jti` into the denylist.
   */
  async logout(jti: string, userId: string, exp: number): Promise<void> {
    await this.prisma.revokedToken.create({
      data: { jti, userId, expiresAt: new Date(exp * 1000) },
    });
  }

  /**
   * Issues a password reset token and emails the link.
   * Always resolves — never reveals whether the email is registered (FR-016).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalised = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (!user || user.deletedAt) return;

    // Invalidate previous outstanding tokens (FR-015).
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });

    const raw = randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(raw);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const link = `${this.resetLinkBaseUrl}?token=${raw}`;
    await this.emailService.sendPasswordResetEmail(user.email, link);
  }

  /**
   * Validates the reset token and updates the user's password.
   * @throws AppError(400) if the token is unknown, expired, used, or invalidated.
   */
  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashResetToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record) {
      throw new AppError(INVALID_RESET, 400, 'INVALID_RESET_TOKEN');
    }
    const now = new Date();
    if (record.usedAt || record.invalidatedAt || record.expiresAt.getTime() <= now.getTime()) {
      throw new AppError(INVALID_RESET, 400, 'INVALID_RESET_TOKEN');
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } });
  }
}
