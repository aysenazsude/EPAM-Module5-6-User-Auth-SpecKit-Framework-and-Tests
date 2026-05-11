import { errorHandler } from '../../../src/middleware/errorHandler';
import { AppError } from '../../../src/shared/errors/AppError';
import { ZodError, z } from 'zod';

function mockRes() {
  const res: { statusCode?: number; body?: unknown; status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((c: number) => { res.statusCode = c; return res; });
  res.json.mockImplementation((b: unknown) => { res.body = b; return res; });
  return res;
}

const noop = jest.fn();

describe('errorHandler', () => {
  it('should serialise a ZodError as 422 with field details', () => {
    let zerr!: ZodError;
    try { z.object({ a: z.string() }).parse({}); } catch (e) { zerr = e as ZodError; }
    const res = mockRes();

    errorHandler(zerr, {} as never, res as never, noop);

    expect(res.statusCode).toBe(422);
    expect((res.body as { details: unknown[] }).details).toBeDefined();
  });

  it('should serialise an AppError including details when present', () => {
    const err = new AppError('Boom', 418, 'TEAPOT', { foo: 'bar' });
    const res = mockRes();

    errorHandler(err, {} as never, res as never, noop);

    expect(res.statusCode).toBe(418);
    expect(res.body).toEqual({ error: 'Boom', details: { foo: 'bar' } });
  });

  it('should serialise an AppError without details when none provided', () => {
    const err = new AppError('Plain', 400, 'BAD');
    const res = mockRes();

    errorHandler(err, {} as never, res as never, noop);

    expect(res.body).toEqual({ error: 'Plain' });
  });

  it('should map an unknown error to 500 with the original message in non-production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const res = mockRes();

    errorHandler(new Error('Crash'), {} as never, res as never, noop);

    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe('Crash');
    process.env.NODE_ENV = previous;
  });

  it('should hide internal messages in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = mockRes();

    errorHandler(new Error('Crash'), {} as never, res as never, noop);

    expect((res.body as { error: string }).error).toBe('Internal server error');
    process.env.NODE_ENV = previous;
  });

  it('should map a non-Error rejection to 500 with a generic message', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const res = mockRes();

    errorHandler('weird' as unknown, {} as never, res as never, noop);

    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe('Internal server error');
    process.env.NODE_ENV = previous;
  });
});
