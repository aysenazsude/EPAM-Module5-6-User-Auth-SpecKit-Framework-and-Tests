import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import type { IEmailService } from './email.types';

/**
 * Nodemailer-backed implementation of IEmailService.
 * Configured from validated environment variables.
 */
export class NodemailerEmailService implements IEmailService {
  private transporter: Transporter;

  constructor(transporter?: Transporter) {
    if (transporter) {
      this.transporter = transporter;
    } else {
      const cfg = env();
      this.transporter = nodemailer.createTransport({
        host: cfg.SMTP_HOST,
        port: cfg.SMTP_PORT,
        secure: cfg.SMTP_PORT === 465,
        auth: cfg.SMTP_USER ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS } : undefined,
      });
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await this.transporter.sendMail({
      from: env().SMTP_FROM,
      to,
      subject: 'Password reset',
      text:
        `You requested a password reset.\n\n` +
        `Use the link below within the next hour to set a new password.\n\n` +
        `${resetLink}\n\n` +
        `If you did not request this, you can safely ignore this email.`,
    });
  }
}
