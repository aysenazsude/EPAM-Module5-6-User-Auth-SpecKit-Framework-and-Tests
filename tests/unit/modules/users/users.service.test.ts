import { UsersService } from '../../../../src/modules/users/users.service';
import { createPrismaFake } from '../../../helpers/prisma-fake';

function setup() {
  const prisma = createPrismaFake();
  const service = new UsersService(prisma as never);
  return { prisma, service };
}

describe('UsersService.getProfile', () => {
  it('should return id, email, and createdAt for an active user', async () => {
    const { prisma, service } = setup();
    const created = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'x' },
    });

    const profile = await service.getProfile(created.id);

    expect(profile).toEqual({
      id: created.id,
      email: 'alice@example.com',
      createdAt: created.createdAt.toISOString(),
    });
  });

  it('should throw 404 for a deleted user', async () => {
    const { prisma, service } = setup();
    const created = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'x', deletedAt: new Date() },
    });

    await expect(service.getProfile(created.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should throw 404 for an unknown user id', async () => {
    const { service } = setup();
    await expect(service.getProfile('does-not-exist')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('UsersService.deleteAccount', () => {
  it('should soft-delete the user, replace the email with a tombstone, and revoke the active token', async () => {
    const { prisma, service } = setup();
    const created = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'h' },
    });
    const exp = Math.floor(Date.now() / 1000) + 3600;

    await service.deleteAccount(created.id, 'jti-active', exp);

    const after = prisma._state.users.find((u) => u.id === created.id)!;
    expect(after.deletedAt).not.toBeNull();
    expect(after.email).toBe(`DELETED-${created.id}@removed`);
    expect(after.passwordHash).toBe('');
    expect(prisma._state.revokedTokens).toHaveLength(1);
    expect(prisma._state.revokedTokens[0].jti).toBe('jti-active');
  });

  it('should throw 404 if the user is already deleted', async () => {
    const { prisma, service } = setup();
    const created = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'h', deletedAt: new Date() },
    });

    await expect(service.deleteAccount(created.id, 'jti', 0)).rejects.toMatchObject({ statusCode: 404 });
  });
});
