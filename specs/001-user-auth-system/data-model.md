# Data Model: User Authentication System

**Feature**: `001-user-auth-system`  
**Phase**: 1 — Design  
**Date**: 2026-05-09

---

## Entities

### 1. User

Represents a registered account. The only personal data stored are email and hashed
password (GDPR data minimisation — FR-018).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, `gen_random_uuid()` | Stable identifier across all related records |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | Normalised to lowercase before storage |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash (cost 12); plaintext never stored |
| `status` | ENUM `('active','locked')` | NOT NULL, DEFAULT `'active'` | Locks automatically; see state machine |
| `lock_expires_at` | TIMESTAMPTZ | NULLABLE | Set when locked; NULL when active |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Registration timestamp |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft-delete marker for GDPR erasure; personal data zeroed separately |

**Notes**:
- `deleted_at` is used for a two-phase GDPR deletion: immediate soft-delete (tokens invalidated) + background hard-delete of personal data within 30 days (SC-008).
- After erasure, `email` is replaced with a tombstone value (e.g. `DELETED-<id>@removed`) and `password_hash` is cleared.

#### User Status State Machine

```
         Registration
              │
              ▼
          ┌────────┐    5 failed logins in 10 min   ┌────────┐
          │ active │ ──────────────────────────────▶ │ locked │
          │        │ ◀──────────────────────────────  │        │
          └────────┘     10-min window expires        └────────┘
              │
              │  DELETE /users/me
              ▼
          ┌─────────┐
          │ deleted │  (soft-deleted; personal data scrubbed async)
          └─────────┘
```

---

### 2. PasswordResetToken

Represents a pending password recovery request. Only a SHA-256 hash of the token is
stored; the raw token travels exclusively in the email link.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, `gen_random_uuid()` | |
| `user_id` | UUID | FK → `users.id` ON DELETE CASCADE | Cascade ensures cleanup on user deletion |
| `token_hash` | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 hex digest of the raw reset token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Issuance time + 1 hour (FR-013) |
| `used_at` | TIMESTAMPTZ | NULLABLE | Set on first use; subsequent uses rejected (FR-014) |
| `invalidated_at` | TIMESTAMPTZ | NULLABLE | Set when a newer token is issued (FR-015) or user deleted |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | |

**Validity rules** (checked before allowing reset):
1. `used_at IS NULL` — not already consumed
2. `invalidated_at IS NULL` — not superseded
3. `expires_at > NOW()` — not expired

When a **new** reset is requested for the same account, all existing tokens for that
`user_id` with `invalidated_at IS NULL` are bulk-updated: `SET invalidated_at = NOW()`.

---

### 3. RevokedToken

Enables server-side JWT invalidation for logout (FR-010) and GDPR account deletion
(FR-017). Checked by the auth middleware on every protected request.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, `gen_random_uuid()` | |
| `jti` | VARCHAR(36) | NOT NULL, UNIQUE, INDEXED | JWT ID claim (UUID) |
| `user_id` | UUID | FK → `users.id` ON DELETE CASCADE | Cascade invalidates all tokens on deletion |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Copied from JWT `exp`; used for row cleanup |
| `revoked_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Audit timestamp |

**Cleanup**: Rows where `expires_at < NOW()` can be deleted safely — expired tokens are
rejected by JWT verification before the denylist is even checked.

---

### 4. LoginAttempt

Tracks failed login attempts per email address for rate limiting (FR-011). A single
upserted row per `key` (normalised email) avoids table bloat.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `key` | VARCHAR(255) | PK | Normalised email address |
| `count` | INTEGER | NOT NULL, DEFAULT `0` | Cumulative failures in the current window |
| `reset_at` | TIMESTAMPTZ | NOT NULL | When the current window expires; lockout lifted after this time |

**Logic**:
- On failed login: `INSERT … ON CONFLICT (key) DO UPDATE SET count = count + 1`.
- Auth middleware: if `count >= 5 AND reset_at > NOW()` → 429, include `Retry-After` header.
- On window expiry (`reset_at <= NOW()`): reset `count = 1, reset_at = NOW() + 10 min`.
- On successful login: delete or reset the row for that key.

---

## Relationships

```
users ──< password_reset_tokens   (one user → many reset tokens; cascade delete)
users ──< revoked_tokens           (one user → many revoked tokens; cascade delete)
login_attempts                     (keyed by email string; no FK — survives user deletion)
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserStatus {
  active
  locked
}

model User {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email          String    @unique @db.VarChar(255)
  passwordHash   String    @db.VarChar(255)
  status         UserStatus @default(active)
  lockExpiresAt  DateTime? @db.Timestamptz
  createdAt      DateTime  @default(now()) @db.Timestamptz
  deletedAt      DateTime? @db.Timestamptz

  passwordResetTokens PasswordResetToken[]
  revokedTokens       RevokedToken[]

  @@map("users")
}

model PasswordResetToken {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String    @db.Uuid
  tokenHash      String    @unique @db.VarChar(64)
  expiresAt      DateTime  @db.Timestamptz
  usedAt         DateTime? @db.Timestamptz
  invalidatedAt  DateTime? @db.Timestamptz
  createdAt      DateTime  @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("password_reset_tokens")
}

model RevokedToken {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jti       String   @unique @db.VarChar(36)
  userId    String   @db.Uuid
  expiresAt DateTime @db.Timestamptz
  revokedAt DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([jti])
  @@map("revoked_tokens")
}

model LoginAttempt {
  key     String   @id @db.VarChar(255)
  count   Int      @default(0)
  resetAt DateTime @db.Timestamptz

  @@map("login_attempts")
}
```

---

## Validation Rules

### User Registration (FR-001 – FR-005)

| Field | Rule |
|-------|------|
| `email` | Valid RFC 5322 format; lowercase-normalised; max 255 chars |
| `password` | Min 8 chars; ≥ 1 uppercase letter; ≥ 1 lowercase letter; ≥ 1 digit |

### Password Reset Confirmation (FR-013 – FR-015)

| Field | Rule |
|-------|------|
| `token` | Non-empty string; SHA-256 hash must match a valid, unused, non-expired record |
| `newPassword` | Same strength rules as registration password |

---

## Indexes

| Table | Column(s) | Type | Purpose |
|-------|-----------|------|---------|
| `users` | `email` | UNIQUE | Fast lookup on login/registration |
| `users` | `deleted_at` | Partial (IS NULL) | Filter out deleted accounts |
| `password_reset_tokens` | `token_hash` | UNIQUE | Token lookup on reset confirmation |
| `password_reset_tokens` | `user_id` | B-tree | Bulk-invalidate older tokens per user |
| `revoked_tokens` | `jti` | UNIQUE + B-tree | Fast denylist check in auth middleware |
| `revoked_tokens` | `expires_at` | B-tree | Efficient cleanup of expired rows |
| `login_attempts` | `key` | PK | Upsert on failed login |
