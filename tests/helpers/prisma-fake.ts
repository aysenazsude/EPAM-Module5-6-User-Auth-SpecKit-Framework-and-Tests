/**
 * Hand-rolled in-memory Prisma client fake for unit tests (per TP-VI).
 * Implements only the slices the services actually call.
 */

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  status: 'active' | 'locked';
  lockExpiresAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export type ResetTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  invalidatedAt: Date | null;
  createdAt: Date;
};

export type RevokedTokenRow = {
  id: string;
  jti: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date;
};

export type LoginAttemptRow = {
  key: string;
  count: number;
  resetAt: Date;
};

let counter = 0;
const id = (): string => `id-${++counter}`;

export function createPrismaFake() {
  const users: UserRow[] = [];
  const resetTokens: ResetTokenRow[] = [];
  const revokedTokens: RevokedTokenRow[] = [];
  const loginAttempts: LoginAttemptRow[] = [];

  return {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email !== undefined) return users.find((u) => u.email === where.email) ?? null;
        if (where.id !== undefined) return users.find((u) => u.id === where.id) ?? null;
        return null;
      }),
      create: jest.fn(async ({ data }: { data: Partial<UserRow> & { email: string; passwordHash: string } }) => {
        const row: UserRow = {
          id: data.id ?? id(),
          email: data.email,
          passwordHash: data.passwordHash,
          status: data.status ?? 'active',
          lockExpiresAt: data.lockExpiresAt ?? null,
          createdAt: data.createdAt ?? new Date(),
          deletedAt: data.deletedAt ?? null,
        };
        users.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        const idx = users.findIndex((u) => u.id === where.id);
        if (idx === -1) throw new Error('User not found');
        users[idx] = { ...users[idx], ...data };
        return users[idx];
      }),
    },
    passwordResetToken: {
      create: jest.fn(async ({ data }: { data: Partial<ResetTokenRow> & { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const row: ResetTokenRow = {
          id: data.id ?? id(),
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          usedAt: data.usedAt ?? null,
          invalidatedAt: data.invalidatedAt ?? null,
          createdAt: data.createdAt ?? new Date(),
        };
        resetTokens.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        return resetTokens.find((t) => t.tokenHash === where.tokenHash) ?? null;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { userId: string; invalidatedAt: null }; data: { invalidatedAt: Date } }) => {
        let count = 0;
        for (const t of resetTokens) {
          if (t.userId === where.userId && t.invalidatedAt === null) {
            t.invalidatedAt = data.invalidatedAt;
            count++;
          }
        }
        return { count };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<ResetTokenRow> }) => {
        const idx = resetTokens.findIndex((t) => t.id === where.id);
        if (idx === -1) throw new Error('Token not found');
        resetTokens[idx] = { ...resetTokens[idx], ...data };
        return resetTokens[idx];
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    revokedToken: {
      create: jest.fn(async ({ data }: { data: Partial<RevokedTokenRow> & { jti: string; userId: string; expiresAt: Date } }) => {
        const row: RevokedTokenRow = {
          id: data.id ?? id(),
          jti: data.jti,
          userId: data.userId,
          expiresAt: data.expiresAt,
          revokedAt: data.revokedAt ?? new Date(),
        };
        revokedTokens.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { jti: string } }) => {
        return revokedTokens.find((r) => r.jti === where.jti) ?? null;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    loginAttempt: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) => {
        return loginAttempts.find((a) => a.key === where.key) ?? null;
      }),
      upsert: jest.fn(async ({ where, create, update }: { where: { key: string }; create: LoginAttemptRow; update: Partial<LoginAttemptRow> }) => {
        const existing = loginAttempts.find((a) => a.key === where.key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: LoginAttemptRow = { ...create };
        loginAttempts.push(row);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { key: string } }) => {
        const idx = loginAttempts.findIndex((a) => a.key === where.key);
        if (idx >= 0) loginAttempts.splice(idx, 1);
      }),
    },
    _state: { users, resetTokens, revokedTokens, loginAttempts },
  };
}

export type PrismaFake = ReturnType<typeof createPrismaFake>;
