import { z } from 'zod';

/**
 * Zod schema for validated process environment variables.
 * Throws on startup if any required variable is missing or malformed.
 */
const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().regex(/^\d+$/),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().email('SMTP_FROM must be a valid email'),
});

export type AppEnv = {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
};

/**
 * Parses and validates the process environment.
 * @throws Error if any required variable is missing or invalid.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return {
    PORT: parseInt(parsed.data.PORT, 10),
    DATABASE_URL: parsed.data.DATABASE_URL,
    JWT_SECRET: parsed.data.JWT_SECRET,
    SMTP_HOST: parsed.data.SMTP_HOST,
    SMTP_PORT: parseInt(parsed.data.SMTP_PORT, 10),
    SMTP_USER: parsed.data.SMTP_USER,
    SMTP_PASS: parsed.data.SMTP_PASS,
    SMTP_FROM: parsed.data.SMTP_FROM,
  };
}

/** Lazily-loaded singleton environment. */
let cached: AppEnv | undefined;
export function env(): AppEnv {
  if (!cached) cached = loadEnv();
  return cached;
}
