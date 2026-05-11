import type { IEmailService } from '../../src/shared/email/email.types';

/**
 * Returns a Jest-mocked IEmailService implementation suitable for unit tests.
 */
export function setupMockEmailService(): jest.Mocked<IEmailService> {
  return {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };
}
