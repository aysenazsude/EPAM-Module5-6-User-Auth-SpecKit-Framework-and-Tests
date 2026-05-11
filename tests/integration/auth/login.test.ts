import request from 'supertest';
import { buildTestHarness, teardownTestHarness, type TestHarness } from '../../helpers/test-harness';

async function registerUser(h: TestHarness, email = 'alice@example.com', password = 'P@ssw0rd1') {
  await request(h.app).post('/auth/register').send({ email, password });
}

describe('POST /auth/login', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should return 200 with a JWT and ISO expiresAt for valid credentials', async () => {
    await registerUser(h);

    const res = await request(h.app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('should return 401 with the same generic error for unknown email and wrong password', async () => {
    await registerUser(h);

    const wrongPw = await request(h.app).post('/auth/login').send({ email: 'alice@example.com', password: 'wrong' });
    const ghost = await request(h.app).post('/auth/login').send({ email: 'ghost@example.com', password: 'whatever' });

    expect(wrongPw.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(wrongPw.body.error).toBe(ghost.body.error);
  });

  it('should return 429 with Retry-After after 5 consecutive failures', async () => {
    await registerUser(h);

    for (let i = 0; i < 5; i++) {
      await request(h.app).post('/auth/login').send({ email: 'alice@example.com', password: 'wrong' });
    }
    const res = await request(h.app).post('/auth/login').send({ email: 'alice@example.com', password: 'P@ssw0rd1' });

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('should return 422 for malformed body', async () => {
    const res = await request(h.app).post('/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});
