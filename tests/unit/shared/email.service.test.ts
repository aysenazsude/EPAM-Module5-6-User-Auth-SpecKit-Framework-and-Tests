jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

jest.mock('../../../src/config/env', () => ({
  env: jest.fn(),
}));

import nodemailer from 'nodemailer';
import { env } from '../../../src/config/env';
import { NodemailerEmailService } from '../../../src/shared/email/email.service';

const mockedCreateTransport = nodemailer.createTransport as jest.Mock;
const mockedEnv = env as jest.Mock;

function makeFakeTransporter() {
  return { sendMail: jest.fn().mockResolvedValue(undefined) } as unknown as {
    sendMail: jest.Mock;
  };
}

describe('NodemailerEmailService — constructor', () => {
  it('should use the provided transporter without calling nodemailer.createTransport', () => {
    // Arrange
    const transporter = makeFakeTransporter();

    // Act
    new NodemailerEmailService(transporter as never);

    // Assert
    expect(mockedCreateTransport).not.toHaveBeenCalled();
    expect(mockedEnv).not.toHaveBeenCalled();
  });

  it('should build a transporter from env() with auth when SMTP_USER is set and secure=false for non-465 ports', () => {
    // Arrange
    mockedEnv.mockReturnValue({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_USER: 'user@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'noreply@example.com',
    });
    const fake = makeFakeTransporter();
    mockedCreateTransport.mockReturnValueOnce(fake);

    // Act
    new NodemailerEmailService();

    // Assert
    expect(mockedCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockedCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user@example.com', pass: 'secret' },
    });
  });

  it('should build a transporter with secure=true when SMTP_PORT is 465', () => {
    // Arrange
    mockedEnv.mockReturnValue({
      SMTP_HOST: 'smtp.tls.example.com',
      SMTP_PORT: 465,
      SMTP_USER: 'user@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'noreply@example.com',
    });
    mockedCreateTransport.mockReturnValueOnce(makeFakeTransporter());

    // Act
    new NodemailerEmailService();

    // Assert
    expect(mockedCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true })
    );
  });

  it('should omit auth when SMTP_USER is empty', () => {
    // Arrange
    mockedEnv.mockReturnValue({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: 'noreply@example.com',
    });
    mockedCreateTransport.mockReturnValueOnce(makeFakeTransporter());

    // Act
    new NodemailerEmailService();

    // Assert
    expect(mockedCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined })
    );
  });
});

describe('NodemailerEmailService.sendPasswordResetEmail', () => {
  it('should send a mail with from from env, the given recipient, the fixed subject, and a body containing the reset link', async () => {
    // Arrange
    mockedEnv.mockReturnValue({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_USER: 'user@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'noreply@example.com',
    });
    const transporter = makeFakeTransporter();
    const service = new NodemailerEmailService(transporter as never);
    const resetLink = 'https://app.example.com/reset?token=abc123';

    // Act
    await service.sendPasswordResetEmail('alice@example.com', resetLink);

    // Assert
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    const sentArg = transporter.sendMail.mock.calls[0][0];
    expect(sentArg).toMatchObject({
      from: 'noreply@example.com',
      to: 'alice@example.com',
      subject: 'Password reset',
    });
    expect(sentArg.text).toContain(resetLink);
    expect(sentArg.text).toContain('within the next hour');
  });

  it('should propagate transporter errors to the caller', async () => {
    // Arrange
    mockedEnv.mockReturnValue({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: 'noreply@example.com',
    });
    const transporter = makeFakeTransporter();
    transporter.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    const service = new NodemailerEmailService(transporter as never);

    // Act + Assert
    await expect(
      service.sendPasswordResetEmail('alice@example.com', 'https://x/y')
    ).rejects.toThrow('SMTP down');
  });
});
