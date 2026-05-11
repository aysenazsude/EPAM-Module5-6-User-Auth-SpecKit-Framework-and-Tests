process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test-secret';
process.env.DATABASE_URL = 'postgresql://test';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_FROM = 'test@example.com';

jest.mock('../../../../src/config/db', () => ({
  prisma: {
    revokedToken: { deleteMany: jest.fn() },
    passwordResetToken: { deleteMany: jest.fn() },
  },
}));

import jwt from 'jsonwebtoken';
import {
  signToken,
  verifyToken,
  TOKEN_TTL_SECONDS,
  deleteExpiredRevokedTokens,
  deleteExpiredPasswordResetTokens,
} from '../../../../src/shared/token/jwt.util';
import { prisma } from '../../../../src/config/db';

describe('signToken', () => {
  it('should produce a JWT containing sub, jti, and exp 24h ahead', () => {
    const before = Math.floor(Date.now() / 1000);

    const { token, jti, expiresAt } = signToken('user-1');

    expect(token.split('.')).toHaveLength(3);
    expect(jti).toMatch(/^[0-9a-f-]{36}$/);
    const expSec = Math.floor(expiresAt.getTime() / 1000);
    expect(expSec - before).toBeGreaterThanOrEqual(TOKEN_TTL_SECONDS - 2);
    expect(expSec - before).toBeLessThanOrEqual(TOKEN_TTL_SECONDS + 2);
  });
});

describe('verifyToken', () => {
  it('should decode a freshly signed token and expose the same sub/jti', () => {
    const { token, jti } = signToken('user-42');

    const payload = verifyToken(token);

    expect(payload.sub).toBe('user-42');
    expect(payload.jti).toBe(jti);
  });

  it('should throw on a tampered signature', () => {
    const { token } = signToken('user-42');
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');

    expect(() => verifyToken(tampered)).toThrow();
  });

  it('should throw on an expired token', () => {
    jest.useFakeTimers();
    const { token } = signToken('user-42');
    jest.setSystemTime(Date.now() + (TOKEN_TTL_SECONDS + 60) * 1000);

    expect(() => verifyToken(token)).toThrow();
    jest.useRealTimers();
  });

  it('should throw on a malformed token', () => {
    expect(() => verifyToken('not-a-jwt')).toThrow();
  });

  it('should throw "Invalid token payload" when the JWT payload is a string (non-object)', () => {
    // Arrange — sign a string payload; jwt.verify returns it as a string.
    const token = jwt.sign('plain-string-payload', process.env.JWT_SECRET as string, {
      algorithm: 'HS256',
    });

    // Act + Assert
    expect(() => verifyToken(token)).toThrow('Invalid token payload');
  });

  it('should throw "Invalid token claims" when sub/jti/exp are missing or wrong types', () => {
    // Arrange — sign an object payload missing the required string claims.
    const token = jwt.sign(
      { sub: 123, jti: 456 },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', noTimestamp: true }
    );

    // Act + Assert
    expect(() => verifyToken(token)).toThrow('Invalid token claims');
  });
});

describe('deleteExpiredRevokedTokens', () => {
  it('should call prisma.revokedToken.deleteMany with expiresAt < now and return the count', async () => {
    // Arrange
    const deleteMany = prisma.revokedToken.deleteMany as jest.Mock;
    deleteMany.mockResolvedValueOnce({ count: 7 });

    // Act
    const result = await deleteExpiredRevokedTokens();

    // Assert
    expect(result).toBe(7);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    const arg = deleteMany.mock.calls[0][0];
    expect(arg.where.expiresAt.lt).toBeInstanceOf(Date);
    expect((arg.where.expiresAt.lt as Date).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('deleteExpiredPasswordResetTokens', () => {
  it('should call prisma.passwordResetToken.deleteMany with expiresAt < now and return the count', async () => {
    // Arrange
    const deleteMany = prisma.passwordResetToken.deleteMany as jest.Mock;
    deleteMany.mockResolvedValueOnce({ count: 3 });

    // Act
    const result = await deleteExpiredPasswordResetTokens();

    // Assert
    expect(result).toBe(3);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    const arg = deleteMany.mock.calls[0][0];
    expect(arg.where.expiresAt.lt).toBeInstanceOf(Date);
    expect((arg.where.expiresAt.lt as Date).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
