import { createApp } from './app';
import { env } from './config/env';
import {
  deleteExpiredRevokedTokens,
  deleteExpiredPasswordResetTokens,
} from './shared/token/jwt.util';

/**
 * Application entrypoint.
 * Cleans expired revoked tokens and password-reset tokens on startup, then
 * starts the HTTP server.
 */
async function main(): Promise<void> {
  await Promise.allSettled([
    deleteExpiredRevokedTokens(),
    deleteExpiredPasswordResetTokens(),
  ]);

  const cfg = env();
  const app = createApp();
  app.listen(cfg.PORT, () => {
    console.log(`Auth API listening on http://localhost:${cfg.PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
