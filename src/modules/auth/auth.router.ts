import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticate } from '../../middleware/authenticate';
import { NodemailerEmailService } from '../../shared/email/email.service';
import { AuthService } from './auth.service';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestBodySchema,
  PasswordResetConfirmBodySchema,
} from './auth.schema';
import { AppError } from '../../shared/errors/AppError';

/** Lazy singleton service so env() validation happens after dotenv load in tests. */
let serviceInstance: AuthService | null = null;
function getAuthService(): AuthService {
  if (!serviceInstance) {
    serviceInstance = new AuthService(prisma, new NodemailerEmailService());
  }
  return serviceInstance;
}

/** Test-only injection seam. */
export function _setAuthService(service: AuthService | null): void {
  serviceInstance = service;
}

export const authRouter = Router();

/** POST /auth/register */
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterRequestSchema.parse(req.body);
    await getAuthService().register(body.email, body.password);
    res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    next(err);
  }
});

/** POST /auth/login */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LoginRequestSchema.parse(req.body);
    const result = await getAuthService().login(body.email, body.password);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 429) {
      const details = err.details as { retryAfter?: number } | undefined;
      if (details?.retryAfter) res.setHeader('Retry-After', String(details.retryAfter));
    }
    next(err);
  }
});

/** POST /auth/logout */
authRouter.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    await getAuthService().logout(req.user.jti, req.user.userId, req.user.exp);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/** POST /auth/password-reset/request */
authRouter.post('/password-reset/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = PasswordResetRequestBodySchema.parse(req.body);
    await getAuthService().requestPasswordReset(body.email);
    res.status(202).json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

/** POST /auth/password-reset/confirm */
authRouter.post('/password-reset/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = PasswordResetConfirmBodySchema.parse(req.body);
    await getAuthService().confirmPasswordReset(body.token, body.newPassword);
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});
