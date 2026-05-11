import request from 'supertest';
import { buildTestHarness, teardownTestHarness, type TestHarness } from '../../helpers/test-harness';

async function register(h: TestHarness, email = 'alice@example.com', pw = 'P@ssw0rd1') {
  await request(h.app).post('/auth/register').send({ email, password: pw });
}

function tokenFromLink(link: string): string {
  return new URL(link).searchParams.get('token')!;
}

describe('POST /auth/password-reset/request', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should return 202 and send an email for a known address', async () => {
    await register(h);

    const res = await request(h.app).post('/auth/password-reset/request').send({ email: 'alice@example.com' });

    expect(res.status).toBe(202);
    expect(h.emailMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('should return 202 for an unknown address without revealing existence', async () => {
    const res = await request(h.app).post('/auth/password-reset/request').send({ email: 'ghost@example.com' });

    expect(res.status).toBe(202);
    expect(h.emailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should return 422 for an invalid email format', async () => {
    const res = await request(h.app).post('/auth/password-reset/request').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

describe('POST /auth/password-reset/confirm', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should set a new password and let the user log in with it', async () => {
    await register(h);
    await request(h.app).post('/auth/password-reset/request').send({ email: 'alice@example.com' });
    const raw = tokenFromLink(h.resetEmailLink()!);

    const confirm = await request(h.app)
      .post('/auth/password-reset/confirm')
      .send({ token: raw, newPassword: 'NewP@ssw0rd1' });
    expect(confirm.status).toBe(200);

    const login = await request(h.app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'NewP@ssw0rd1' });
    expect(login.status).toBe(200);
  });

  it('should return 400 when reusing an already-used token', async () => {
    await register(h);
    await request(h.app).post('/auth/password-reset/request').send({ email: 'alice@example.com' });
    const raw = tokenFromLink(h.resetEmailLink()!);
    await request(h.app).post('/auth/password-reset/confirm').send({ token: raw, newPassword: 'NewP@ssw0rd1' });

    const second = await request(h.app)
      .post('/auth/password-reset/confirm')
      .send({ token: raw, newPassword: 'AnotherP@ss1' });
    expect(second.status).toBe(400);
  });

  it('should invalidate previous links when a new one is issued', async () => {
    await register(h);
    await request(h.app).post('/auth/password-reset/request').send({ email: 'alice@example.com' });
    const firstRaw = tokenFromLink(h.resetEmailLink()!);
    await request(h.app).post('/auth/password-reset/request').send({ email: 'alice@example.com' });

    const res = await request(h.app)
      .post('/auth/password-reset/confirm')
      .send({ token: firstRaw, newPassword: 'NewP@ssw0rd1' });

    expect(res.status).toBe(400);
  });
});
