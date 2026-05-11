/**
 * Test session fixture.
 */
export interface TestSession {
  userId: string;
  jti: string;
  token: string;
  expiresAt: Date;
}

let counter = 0;

export function createTestSession(overrides: Partial<TestSession> = {}): TestSession {
  counter += 1;
  return {
    userId: `user-${counter}`,
    jti: `jti-${counter}`,
    token: `token-${counter}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}
