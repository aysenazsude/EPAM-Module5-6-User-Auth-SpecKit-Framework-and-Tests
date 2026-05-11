import type { UserRow } from '../helpers/prisma-fake';

let counter = 0;

/**
 * Factory creating a deterministic User row for tests.
 * Caller can override any field via `overrides`.
 */
export function createTestUser(overrides: Partial<UserRow> = {}): UserRow {
  counter += 1;
  return {
    id: `user-${counter}`,
    email: `user${counter}@example.com`,
    passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR',
    status: 'active',
    lockExpiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}
