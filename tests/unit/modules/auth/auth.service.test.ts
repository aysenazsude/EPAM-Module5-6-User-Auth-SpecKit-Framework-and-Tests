import { AuthService, RATE_LIMIT_MAX_FAILURES, RESET_TOKEN_TTL_MS } from '../../../../src/modules/auth/auth.service';
import { AppError } from '../../../../src/shared/errors/AppError';
import { createPrismaFake } from '../../../helpers/prisma-fake';
import { setupMockEmailService } from '../../../fixtures/email.fixture';
import { hashPassword } from '../../../../src/shared/password/password.util';
import { createHash } from 'crypto';

// Stub env so token signing works without real .env.
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test-secret';
process.env.DATABASE_URL = 'postgresql://test';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_FROM = 'test@example.com';

function setup() {
  const prisma = createPrismaFake();
  const email = setupMockEmailService();
  const service = new AuthService(prisma as never, email);
  return { prisma, email, service };
}

describe('AuthService.register', () => {
  it('should hash the password and persist a user when the email is new', async () => {
    const { prisma, service } = setup();

    await service.register('Alice@Example.com', 'P@ssw0rd1');

    expect(prisma._state.users).toHaveLength(1);
    const user = prisma._state.users[0];
    expect(user.email).toBe('alice@example.com');
    expect(user.passwordHash).not.toBe('P@ssw0rd1');
    expect(user.passwordHash.length).toBeGreaterThan(20);
  });

  it('should throw AppError(409) when the email is already registered', async () => {
    const { prisma, service } = setup();
    await service.register('alice@example.com', 'P@ssw0rd1');

    await expect(service.register('alice@example.com', 'OtherP@ss1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_IN_USE',
    });
    expect(prisma._state.users).toHaveLength(1);
  });
});

describe('AuthService.login', () => {
  it('should return a signed token when credentials are valid', async () => {
    const { prisma, service } = setup();
    const passwordHash = await hashPassword('P@ssw0rd1');
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } });

    const result = await service.login('alice@example.com', 'P@ssw0rd1');

    expect(typeof result.token).toBe('string');
    expect(result.token.split('.')).toHaveLength(3);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('should throw AppError(401) on wrong password', async () => {
    const { prisma, service } = setup();
    const passwordHash = await hashPassword('P@ssw0rd1');
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } });

    await expect(service.login('alice@example.com', 'wrong')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('should throw AppError(401) when the email is unknown', async () => {
    const { service } = setup();
    await expect(service.login('ghost@example.com', 'whatever')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('should throw AppError(429) after 5 consecutive failures within the window', async () => {
    const { prisma, service } = setup();
    const passwordHash = await hashPassword('P@ssw0rd1');
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } });

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i++) {
      await expect(service.login('alice@example.com', 'wrong')).rejects.toMatchObject({ statusCode: 401 });
    }
    await expect(service.login('alice@example.com', 'P@ssw0rd1')).rejects.toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('should reset the failure counter after the window expires', async () => {
    jest.useFakeTimers();
    const { prisma, service } = setup();
    const passwordHash = await hashPassword('P@ssw0rd1');
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } });

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i++) {
      await expect(service.login('alice@example.com', 'wrong')).rejects.toMatchObject({ statusCode: 401 });
    }
    // Advance 11 minutes
    jest.setSystemTime(Date.now() + 11 * 60 * 1000);

    const result = await service.login('alice@example.com', 'P@ssw0rd1');
    expect(typeof result.token).toBe('string');
    jest.useRealTimers();
  });

  it('should reject login for soft-deleted users', async () => {
    const { prisma, service } = setup();
    const passwordHash = await hashPassword('P@ssw0rd1');
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash, deletedAt: new Date() } });

    await expect(service.login('alice@example.com', 'P@ssw0rd1')).rejects.toBeInstanceOf(AppError);
  });
});

describe('AuthService.logout', () => {
  it('should insert a RevokedToken row', async () => {
    const { prisma, service } = setup();
    const exp = Math.floor(Date.now() / 1000) + 3600;

    await service.logout('jti-abc', 'user-1', exp);

    expect(prisma._state.revokedTokens).toHaveLength(1);
    expect(prisma._state.revokedTokens[0].jti).toBe('jti-abc');
    expect(prisma._state.revokedTokens[0].userId).toBe('user-1');
  });
});

describe('AuthService.requestPasswordReset', () => {
  it('should send an email and store a hashed token for a known user', async () => {
    const { prisma, email, service } = setup();
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash: 'x' } });

    await service.requestPasswordReset('alice@example.com');

    expect(prisma._state.resetTokens).toHaveLength(1);
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const link = (email.sendPasswordResetEmail.mock.calls[0] as unknown as [string, string])[1];
    const rawToken = new URL(link).searchParams.get('token');
    expect(rawToken).not.toBeNull();
    const expectedHash = createHash('sha256').update(rawToken!).digest('hex');
    expect(prisma._state.resetTokens[0].tokenHash).toBe(expectedHash);
  });

  it('should silently return for unknown emails (no enumeration)', async () => {
    const { prisma, email, service } = setup();

    await service.requestPasswordReset('ghost@example.com');

    expect(prisma._state.resetTokens).toHaveLength(0);
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should invalidate all previous outstanding tokens for the same user', async () => {
    const { prisma, service } = setup();
    await prisma.user.create({ data: { id: 'user-X', email: 'alice@example.com', passwordHash: 'x' } });

    await service.requestPasswordReset('alice@example.com');
    await service.requestPasswordReset('alice@example.com');

    expect(prisma._state.resetTokens).toHaveLength(2);
    const invalidated = prisma._state.resetTokens.filter((t) => t.invalidatedAt !== null);
    expect(invalidated).toHaveLength(1);
  });
});

describe('AuthService.confirmPasswordReset', () => {
  async function seedToken(svc: AuthService, prisma: ReturnType<typeof createPrismaFake>, email = 'alice@example.com') {
    await prisma.user.create({ data: { email, passwordHash: 'x' } });
    const emailMock = setupMockEmailService();
    // re-wire emailService on a fresh service so we can capture the link
    const captured = { link: '' };
    emailMock.sendPasswordResetEmail.mockImplementation(async (_to, link) => {
      captured.link = link;
    });
    const service = new AuthService(prisma as never, emailMock);
    await service.requestPasswordReset(email);
    void svc;
    const raw = new URL(captured.link).searchParams.get('token')!;
    return { rawToken: raw, service };
  }

  it('should update the password and mark the token used on success', async () => {
    const { prisma, service } = setup();
    const { rawToken, service: svc } = await seedToken(service, prisma);

    await svc.confirmPasswordReset(rawToken, 'NewP@ssw0rd1');

    const tokenRow = prisma._state.resetTokens[0];
    expect(tokenRow.usedAt).not.toBeNull();
    expect(prisma._state.users[0].passwordHash).not.toBe('x');
  });

  it('should reject an unknown token with AppError(400)', async () => {
    const { service } = setup();
    await expect(service.confirmPasswordReset('not-a-real-token', 'NewP@ssw0rd1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
    });
  });

  it('should reject an expired token with AppError(400)', async () => {
    jest.useFakeTimers();
    const { prisma, service } = setup();
    const { rawToken, service: svc } = await seedToken(service, prisma);

    jest.setSystemTime(Date.now() + RESET_TOKEN_TTL_MS + 1000);
    await expect(svc.confirmPasswordReset(rawToken, 'NewP@ssw0rd1')).rejects.toMatchObject({ statusCode: 400 });
    jest.useRealTimers();
  });

  it('should reject a used token on second use', async () => {
    const { prisma, service } = setup();
    const { rawToken, service: svc } = await seedToken(service, prisma);
    await svc.confirmPasswordReset(rawToken, 'NewP@ssw0rd1');

    await expect(svc.confirmPasswordReset(rawToken, 'AnotherP@ss1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
