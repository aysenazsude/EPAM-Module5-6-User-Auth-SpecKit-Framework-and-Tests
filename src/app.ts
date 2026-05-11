import express, { type Express } from 'express';
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { errorHandler } from './middleware/errorHandler';

/**
 * Builds and returns the Express application.
 * No side effects (no listen, no migrations) so it is safe for tests.
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use(errorHandler);
  return app;
}
