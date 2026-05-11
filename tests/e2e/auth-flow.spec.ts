import request from 'supertest';
import { buildTestHarness, teardownTestHarness, type TestHarness } from '../helpers/test-harness';

describe('Auth flow E2E (register → login → /users/me → logout → revoked)', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should walk the full critical user journey successfully', async () => {
    // Register
    const reg = await request(h.app)
      .post('/auth/register')
      .send({ email: 'eve@example.com', password: 'Str0ng!Pass' });
    expect(reg.status).toBe(201);

    // Login
    const login = await request(h.app)
      .post('/auth/login')
      .send({ email: 'eve@example.com', password: 'Str0ng!Pass' });
    expect(login.status).toBe(200);
    const token = login.body.token as string;

    // Authenticated profile read
    const me = await request(h.app).get('/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('eve@example.com');

    // Logout
    const out = await request(h.app).post('/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(204);

    // Revoked token is rejected
    const rejected = await request(h.app).get('/users/me').set('Authorization', `Bearer ${token}`);
    expect(rejected.status).toBe(401);
  });
});
