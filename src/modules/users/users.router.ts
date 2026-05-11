import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticate } from '../../middleware/authenticate';
import { AppError } from '../../shared/errors/AppError';
import { UsersService } from './users.service';

let serviceInstance: UsersService | null = null;
function getUsersService(): UsersService {
  if (!serviceInstance) serviceInstance = new UsersService(prisma);
  return serviceInstance;
}

/** Test-only injection seam. */
export function _setUsersService(service: UsersService | null): void {
  serviceInstance = service;
}

export const usersRouter = Router();

/** GET /users/me — GDPR data export. */
usersRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const profile = await getUsersService().getProfile(req.user.userId);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
});

/** DELETE /users/me — GDPR right to erasure. */
usersRouter.delete('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    await getUsersService().deleteAccount(req.user.userId, req.user.jti, req.user.exp);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
