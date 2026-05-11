/** Contract for sending transactional emails. */
export interface IEmailService {
  /**
   * Sends a password reset email containing the one-time reset link.
   */
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void>;
}
