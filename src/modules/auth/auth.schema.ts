import { z } from 'zod';

const passwordPolicy = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

/** Schema for POST /auth/register body. */
export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: passwordPolicy,
});

/** Schema for POST /auth/login body. */
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password is required'),
});

/** Schema for POST /auth/password-reset/request body. */
export const PasswordResetRequestBodySchema = z.object({
  email: z.string().email('Invalid email format').max(255),
});

/** Schema for POST /auth/password-reset/confirm body. */
export const PasswordResetConfirmBodySchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordPolicy,
});
