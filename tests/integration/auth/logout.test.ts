import request from 'supertest';
import { buildTestHarness, teardownTestHarness, type TestHarness } from '../../helpers/test-harness';

async function registerAndLogin(h: TestHarness): Promise<string> {
  await request(h.app).post('/auth/register').send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
  const res = await request(h.app).post('/auth/login').send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
  return res.body.token as string;
}

describe('POST /auth/logout', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should return 204 for a valid token and revoke it', async () => {
    const token = await registerAndLogin(h);

    const res = await request(h.app).post('/auth/logout').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(h.prisma._state.revokedTokens).toHaveLength(1);
  });

  it('should reject subsequent requests with the same revoked token', async () => {
    const token = await registerAndLogin(h);
    await request(h.app).post('/auth/logout').set('Authorization', `Bearer ${token}`);

    const res = await request(h.app).get('/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('should return 401 without a Bearer token', async () => {
    const res = await request(h.app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});
