import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client used across the application.
 * Reuses the same connection pool for all modules.
 */
export const prisma = new PrismaClient();
