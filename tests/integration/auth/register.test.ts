import request from 'supertest';
import { buildTestHarness, teardownTestHarness, type TestHarness } from '../../helpers/test-harness';

describe('POST /auth/register', () => {
  let h: TestHarness;
  beforeEach(() => { h = buildTestHarness(); });
  afterEach(() => teardownTestHarness());

  it('should return 201 and persist the user when input is valid', async () => {
    const res = await request(h.app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Account created successfully' });
    expect(h.prisma._state.users).toHaveLength(1);
  });

  it('should return 409 for a duplicate email', async () => {
    await request(h.app).post('/auth/register').send({ email: 'alice@example.com', password: 'P@ssw0rd1' });

    const res = await request(h.app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'P@ssw0rd1' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already in use/i);
  });

  it('should return 422 for an invalid email format', async () => {
    const res = await request(h.app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'P@ssw0rd1' });

    expect(res.status).toBe(422);
    expect(res.body.details).toBeDefined();
  });

  it('should return 422 for a weak password', async () => {
    const res = await request(h.app)
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'weak' });

    expect(res.status).toBe(422);
  });
});
