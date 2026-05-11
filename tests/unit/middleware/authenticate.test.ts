process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test-secret';
process.env.DATABASE_URL = 'postgresql://test';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_FROM = 'test@example.com';

import { authenticate } from '../../../src/middleware/authenticate';
import { signToken } from '../../../src/shared/token/jwt.util';
import * as dbModule from '../../../src/config/db';

function mockReq(headers: Record<string, string> = {}) {
  return { headers, user: undefined } as unknown as Parameters<typeof authenticate>[0];
}
const noop = jest.fn();

describe('authenticate middleware', () => {
  let revokedFindUnique: jest.Mock;
  beforeEach(() => {
    revokedFindUnique = jest.fn().mockResolvedValue(null);
    Object.assign(dbModule, { prisma: { revokedToken: { findUnique: revokedFindUnique } } });
  });

  it('should reject when Authorization header is missing', async () => {
    const next = jest.fn();
    await authenticate(mockReq(), {} as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('should reject when scheme is not Bearer', async () => {
    const next = jest.fn();
    await authenticate(mockReq({ authorization: 'Basic xyz' }), {} as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('should reject when token is malformed', async () => {
    const next = jest.fn();
    await authenticate(mockReq({ authorization: 'Bearer not-a-jwt' }), {} as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('should reject when token is revoked', async () => {
    const { token } = signToken('user-1');
    revokedFindUnique.mockResolvedValueOnce({ jti: 'x' });
    const next = jest.fn();

    await authenticate(mockReq({ authorization: `Bearer ${token}` }), {} as never, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('should attach req.user and call next() on success', async () => {
    const { token } = signToken('user-1');
    const req = mockReq({ authorization: `Bearer ${token}` });
    const next = jest.fn();

    await authenticate(req, {} as never, next);

    expect(next).toHaveBeenCalledWith();
    expect((req as unknown as { user: { userId: string } }).user.userId).toBe('user-1');
  });

  it('should reject empty bearer token', async () => {
    const next = jest.fn();
    await authenticate(mockReq({ authorization: 'Bearer ' }), {} as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });
});
