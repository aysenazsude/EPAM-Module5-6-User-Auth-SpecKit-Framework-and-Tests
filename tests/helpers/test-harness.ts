// Shared bootstrap for HTTP-level tests. Injects a Prisma fake into the route
// services so we can exercise express + zod + error middleware without a real DB.

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test-secret';
process.env.DATABASE_URL = 'postgresql://test';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_FROM = 'test@example.com';

import express, { type Express } from 'express';
import { authRouter, _setAuthService } from '../../src/modules/auth/auth.router';
import { usersRouter, _setUsersService } from '../../src/modules/users/users.router';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UsersService } from '../../src/modules/users/users.service';
import { createPrismaFake, type PrismaFake } from './prisma-fake';
import { setupMockEmailService } from '../fixtures/email.fixture';

// Patch the auth middleware's prisma reference so revoked-token lookups hit the fake.
import * as dbModule from '../../src/config/db';

export interface TestHarness {
  app: Express;
  prisma: PrismaFake;
  emailMock: ReturnType<typeof setupMockEmailService>;
  resetEmailLink: () => string | undefined;
}

export function buildTestHarness(): TestHarness {
  const prisma = createPrismaFake();
  const emailMock = setupMockEmailService();
  let lastLink: string | undefined;
  emailMock.sendPasswordResetEmail.mockImplementation(async (_to: string, link: string) => {
    lastLink = link;
  });

  // Override the singleton prisma used by middleware/authenticate.
  Object.assign(dbModule, { prisma });

  const authService = new AuthService(prisma as never, emailMock);
  const usersService = new UsersService(prisma as never);
  _setAuthService(authService);
  _setUsersService(usersService);

  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use(errorHandler);

  return { app, prisma, emailMock, resetEmailLink: () => lastLink };
}

export function teardownTestHarness(): void {
  _setAuthService(null);
  _setUsersService(null);
}
