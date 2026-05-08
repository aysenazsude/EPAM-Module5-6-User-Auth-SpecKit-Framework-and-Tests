# Research: User Authentication System

**Feature**: `001-user-auth-system`  
**Phase**: 0 — Unknowns resolved before design  
**Date**: 2026-05-09

---

## 1. ORM / Database Access Layer

**Decision**: **Prisma ORM** (v5.x)  
**Rationale**:
- Auto-generates TypeScript types from `schema.prisma`; eliminates manual `pg` row mapping.
- Built-in migration runner (`prisma migrate dev / deploy`) with a version-controlled history.
- Query builder is strongly typed — aligns with `strict: true` constitution constraint.
- Lightweight compared to TypeORM for this use case (no active-record pattern needed).

**Alternatives considered**:
- `pg` (node-postgres) with raw SQL — rejected because it requires manual row-to-type mapping and increases boilerplate.
- TypeORM — rejected because decorators conflict with `strict: true` path and bring unnecessary complexity.
- Knex.js — rejected because it lacks first-class TypeScript type generation.

---

## 2. Token Denylist Strategy (Logout / GDPR Erasure)

**Decision**: **PostgreSQL `revoked_tokens` table** with `jti` (JWT ID) and `expires_at` columns  
**Rationale**:
- No additional infrastructure (Redis) required for v1 at 100-concurrent-user scale.
- `jti` (UUID) is embedded in every issued JWT; on logout the `jti` is inserted into `revoked_tokens`.
- Auth middleware performs a single indexed lookup on `jti` to check revocation. At 100 users the lookup cost is negligible.
- Expired rows are cleaned up by a periodic `DELETE FROM revoked_tokens WHERE expires_at < NOW()` — can be run as a cron or startup task.

**Alternatives considered**:
- Redis SET with TTL — rejected (extra infra, overkill at stated scale).
- Short-lived tokens only (no server-side revocation) — rejected because spec requires explicit logout (FR-010) and GDPR account deletion must invalidate tokens immediately (FR-017).

---

## 3. Password Reset Token Security

**Decision**: Store a **SHA-256 hash of the reset token** in PostgreSQL; send the raw token in the email link  
**Rationale**:
- If the database is read by an attacker, hashed tokens cannot be used to reset passwords directly.
- SHA-256 (via Node.js `crypto.createHash`) is fast (no bcrypt-level cost) and appropriate since reset tokens are already high-entropy random values (UUID v4 or 32-byte `crypto.randomBytes`).
- The raw token travels only in the email link and is never stored.

**Alternatives considered**:
- Store raw token — rejected (security risk if DB is compromised).
- bcrypt the reset token — rejected (unnecessary cost; SHA-256 is sufficient for random tokens).

---

## 4. bcrypt Cost Factor

**Decision**: `saltRounds = 12`  
**Rationale**:
- At bcrypt cost 12, hashing takes ~250–400 ms on modern hardware — acceptable for login/registration (target ≤ 3 s p95).
- Provides strong resistance against brute-force even if the hash DB is leaked.
- Cost 10 (library default) is now considered underpowered for new systems.

**Alternatives considered**:
- Cost 10 — rejected (too fast for modern GPUs; increased brute-force risk).
- Cost 14+ — rejected (hash time > 1 s, adds latency risk at 100 concurrent users).

---

## 5. JWT Configuration

**Decision**: **`jsonwebtoken`** library with HS256, 24 h expiry, and `jti` claim  
**Rationale**:
- `jsonwebtoken` is the de-facto Node.js JWT library; well-maintained, TypeScript types via `@types/jsonwebtoken`.
- HS256 with a symmetric secret (env var `JWT_SECRET`) satisfies EC-006 and the spec clarification.
- 24 h expiry encoded as `exp` claim satisfies FR-008.
- `jti` (UUID) embedded on signing enables server-side revocation (logout/GDPR) without storing full tokens.

**Alternatives considered**:
- `jose` library — valid alternative but more complex API; `jsonwebtoken` is sufficient here.
- RS256 (asymmetric) — out of scope per clarification Q4.

---

## 6. Rate Limiting

**Decision**: **`express-rate-limit`** middleware with a **PostgreSQL store** (`rate-limit-postgresql` or custom Prisma-backed store)  
**Rationale**:
- Shared rate-limit state across Node.js processes requires a persistent store — avoids per-process memory that resets on restart or across instances.
- PostgreSQL is already the project's database; no extra infrastructure needed.
- The `rate-limit-postgresql` package provides a Prisma-compatible store; alternatively a lightweight custom store using a `rate_limit_attempts` table is straightforward.
- 5 failures per 10-minute window, then block until window expires — matches FR-011.

**Implementation approach** (custom Prisma-backed store):
- Table: `login_attempts(key TEXT PRIMARY KEY, count INT, reset_at TIMESTAMPTZ)`
- On each failed attempt: upsert + increment count.
- Middleware checks: if `count >= 5` and `reset_at > NOW()`, return 429.
- After `reset_at` passes, row is reset on next attempt (auto-unlock, no admin action).

**Alternatives considered**:
- In-memory store — rejected (state lost on restart; doesn't work across multiple instances).
- Redis + `rate-limit-redis` — rejected (extra infra dependency for v1).

---

## 7. Email Service

**Decision**: **Nodemailer** behind an `IEmailService` interface  
**Rationale**:
- Nodemailer is the standard Node.js email library; easy SMTP configuration.
- Abstracted behind an interface (`IEmailService`) so tests can inject a no-op stub without network calls.
- In production, configure via env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).
- The spec assumption states an existing email service is available in the environment.

**Alternatives considered**:
- SendGrid SDK / AWS SES — valid in production but require additional credentials; Nodemailer supports both as transports if needed.

---

## 8. Input Validation

**Decision**: **Zod** schemas for all incoming request bodies  
**Rationale**:
- Zod produces TypeScript types directly from schemas (`z.infer<typeof schema>`); no separate type declaration needed.
- Runtime validation in Express route handlers with typed, descriptive error messages.
- Aligns with `strict: true` (no `any` leaking through unvalidated request bodies).

**Alternatives considered**:
- `express-validator` — rejected (callback-style API; less idiomatic with TypeScript strict mode).
- Manual validation — rejected (error-prone; duplicates effort).

---

## 9. Environment Configuration

**Decision**: **Zod-parsed `config/env.ts`** that validates all required env vars at startup  
**Rationale**:
- App fails fast on missing config rather than at runtime.
- Type-safe access to env vars throughout the codebase.
- Required variables: `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `PORT` (optional, default 3000).

---

## 10. UUID Generation

**Decision**: **PostgreSQL `gen_random_uuid()`** (built-in since PG 13) as default for primary keys  
**Rationale**:
- No extension required (unlike `uuid-ossp`).
- Prisma supports `@default(dbgenerated("gen_random_uuid()"))` with `@db.Uuid`.

---

## 11. Resolved NEEDS CLARIFICATION Items

| Item | Resolution |
|------|-----------|
| ORM choice | Prisma v5 (see §1) |
| Token revocation for logout | DB-backed `revoked_tokens` table (see §2) |
| Password reset token storage | SHA-256 hash stored; raw token in email (see §3) |
| bcrypt cost | 12 (see §4) |
| Rate-limit state persistence | PostgreSQL store (see §6) |
| Email infrastructure | Nodemailer + `IEmailService` interface (see §7) |
| Request validation | Zod (see §8) |
| UUID generation | `gen_random_uuid()` (see §10) |
