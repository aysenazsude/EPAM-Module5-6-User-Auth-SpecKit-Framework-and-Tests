import request from 'supertest';
import { buildTestHarness, teardownTestHarness, type TestHarness } from '../../helpers/test-harness';

async function registerAndLogin(h: TestHarness): Promise<string> {
  await request(h.app).post('/auth/register').send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
  const res = await request(h.app).post('/auth/login').send({ email: 'alice@example.com', password: 'P@ssw0rd1' });
  return res.body.token as string;
}

describe('GET /users/me', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should return the authenticated profile (id, email, createdAt)', async () => {
    const token = await registerAndLogin(h);

    const res = await request(h.app).get('/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('should return 401 without a token', async () => {
    const res = await request(h.app).get('/users/me');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /users/me', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should return 204 and invalidate the active token', async () => {
    const token = await registerAndLogin(h);

    const del = await request(h.app).delete('/users/me').set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const after = await request(h.app).get('/users/me').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('should replace the email with a tombstone and clear personal data', async () => {
    const token = await registerAndLogin(h);
    await request(h.app).delete('/users/me').set('Authorization', `Bearer ${token}`);

    const stored = h.prisma._state.users[0];
    expect(stored.email).toMatch(/^DELETED-.+@removed$/);
    expect(stored.passwordHash).toBe('');
    expect(stored.deletedAt).not.toBeNull();
  });

  it('should return 401 without a token', async () => {
    const res = await request(h.app).delete('/users/me');
    expect(res.status).toBe(401);
  });
});
