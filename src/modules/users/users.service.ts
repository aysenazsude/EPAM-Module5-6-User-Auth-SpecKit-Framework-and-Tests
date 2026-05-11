import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import type { UserProfile } from './users.types';

/**
 * GDPR account-management service.
 * - getProfile satisfies right of access / data portability (FR-019).
 * - deleteAccount satisfies right to erasure (FR-017).
 */
export class UsersService {
  constructor(
    private readonly prisma: Pick<PrismaClient, 'user' | 'revokedToken'>
  ) {}

  /**
   * Returns the personal data held for the authenticated account.
   * @throws AppError(404) if the account does not exist or is soft-deleted.
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Soft-deletes the account, replaces the email with a tombstone, clears the
   * password hash, and revokes the caller's active token immediately.
   * @throws AppError(404) if already deleted or unknown.
   */
  async deleteAccount(userId: string, activeJti: string, tokenExp: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    const tombstoneEmail = `DELETED-${user.id}@removed`;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), email: tombstoneEmail, passwordHash: '' },
    });
    await this.prisma.revokedToken.create({
      data: { jti: activeJti, userId: user.id, expiresAt: new Date(tokenExp * 1000) },
    });
  }
}
