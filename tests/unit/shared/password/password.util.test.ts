import { hashPassword, verifyPassword } from '../../../../src/shared/password/password.util';

describe('hashPassword + verifyPassword', () => {
  it('should produce a bcrypt hash that is not the plaintext', async () => {
    const hash = await hashPassword('P@ssw0rd1');

    expect(hash).not.toBe('P@ssw0rd1');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('should verify true for the matching plaintext', async () => {
    const hash = await hashPassword('P@ssw0rd1');

    await expect(verifyPassword('P@ssw0rd1', hash)).resolves.toBe(true);
  });

  it('should verify false for a wrong plaintext', async () => {
    const hash = await hashPassword('P@ssw0rd1');

    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('should return false for an empty hash', async () => {
    await expect(verifyPassword('any', '')).resolves.toBe(false);
  });

  it('should return false on invalid hash without throwing', async () => {
    await expect(verifyPassword('any', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });
});
