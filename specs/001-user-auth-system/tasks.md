# Tasks: User Authentication System

**Input**: Design documents from `/specs/001-user-auth-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/openapi.yaml ✅, quickstart.md ✅

**Tests**: Required — engineering constraints EC-004 and EC-005 mandate Testing Pyramid compliance and ≥ 80% business-logic coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every implementation task

## Path Conventions

Single-project layout (see plan.md): `src/`, `tests/`, `prisma/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Node.js/TypeScript project and all tooling so any subsequent phase can start immediately.

- [ ] T001 Initialize Node.js project and install all production dependencies: `npm init -y && npm install express @prisma/client jsonwebtoken bcrypt nodemailer express-rate-limit zod`
- [ ] T002 Install all dev dependencies: `npm install --save-dev typescript @types/node @types/express @types/jsonwebtoken @types/bcrypt @types/nodemailer ts-node ts-jest jest supertest @types/supertest @types/jest`
- [ ] T003 [P] Configure TypeScript with `strict: true` in `tsconfig.json` (target ES2022, moduleResolution node16, outDir dist, rootDir src)
- [ ] T004 [P] Configure Jest in `jest.config.ts` with `ts-jest` preset, coverage thresholds at 80% for branches/lines/functions/statements, and test roots `tests/unit` and `tests/integration`
- [ ] T005 [P] Create `.env.example` with all required variables: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Checkpoint**: `npx tsc --noEmit` passes; `npx jest --passWithNoTests` exits 0.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on. No story work begins until this phase is complete.

**⚠️ CRITICAL**: Phases 3–7 depend on this phase being fully complete.

- [ ] T006 Create validated environment config using Zod in `src/config/env.ts` (parse and export `PORT`, `DATABASE_URL`, `JWT_SECRET`, `SMTP_*`; throw on startup if any required var is missing)
- [ ] T007 Define Prisma schema in `prisma/schema.prisma` with four models: `User` (id, email, password_hash, status enum, lock_expires_at, created_at, deleted_at), `PasswordResetToken` (id, user_id FK, token_hash, expires_at, used_at, invalidated_at, created_at), `RevokedToken` (id, jti unique indexed, user_id FK, expires_at, revoked_at), `LoginAttempt` (key PK, count, reset_at)
- [ ] T008 Run `npx prisma migrate dev --name init` to generate the initial migration and Prisma client (requires `DATABASE_URL` to be set)
- [ ] T009 Create Prisma client singleton in `src/config/db.ts` (single `PrismaClient` instance, reused across modules)
- [ ] T010 [P] Create typed `AppError` class in `src/shared/errors/AppError.ts` (extends `Error`; fields: `statusCode: number`, `code: string`, `isOperational: boolean`)
- [ ] T011 [P] Create bcrypt hash and compare helpers in `src/shared/password/password.util.ts` (`hashPassword(plain: string): Promise<string>` at cost 12, `verifyPassword(plain, hash): Promise<boolean>`)
- [ ] T012 [P] Create JWT sign and verify helpers with `jti` support in `src/shared/token/jwt.util.ts` (`signToken(userId): { token, jti, expiresAt }` — 24 h expiry; `verifyToken(token): JwtPayload`)
- [ ] T013 [P] Define `IEmailService` interface and Nodemailer adapter in `src/shared/email/email.types.ts` and `src/shared/email/email.service.ts` (`sendPasswordResetEmail(to, resetLink): Promise<void>`)
- [ ] T014 Implement centralised error-handler middleware in `src/middleware/errorHandler.ts` (catch `AppError` and generic errors; serialize to `{ error, details? }` JSON; never leak stack traces in production)
- [ ] T015 Implement JWT authentication middleware in `src/middleware/authenticate.ts` (verify token via `jwt.util.ts`, look up `jti` in `RevokedToken` table, attach `req.user = { userId, jti }`, return 401 on failure)
- [ ] T016 Create Express app factory in `src/app.ts` (register `express.json()`, rate-limiter, auth router at `/auth`, users router at `/users`, error handler; no side effects — returns `app` for testing)
- [ ] T017 Create server entry point in `src/server.ts` (call `app.ts` factory, run startup cleanup for expired `RevokedToken` and `PasswordResetToken` rows, start listening on `PORT`)

**Checkpoint**: `npx ts-node src/server.ts` starts without errors; `GET /` returns 404 (no routes yet — expected).

---

## Phase 3: User Story 1 — New User Registration (Priority: P1) 🎯 MVP

**Goal**: A new visitor submits email + password and the system creates an immediately-active account; duplicate or invalid submissions are rejected with clear errors.

**Independent Test**: `POST /auth/register` with valid credentials returns 201; duplicate email returns 409; invalid email returns 422; weak password returns 422. No other story needs to be implemented.

### Tests for User Story 1 ✅

- [ ] T018 [P] [US1] Write unit tests for registration logic in `tests/unit/auth/auth.service.test.ts` — cover: happy path (user created, password hashed), duplicate email throws `AppError(409)`, invalid email format throws `AppError(422)`, weak password throws `AppError(422)`
- [ ] T019 [P] [US1] Write integration tests for `POST /auth/register` in `tests/integration/auth/register.test.ts` — cover all four acceptance scenarios from spec.md using Supertest against the Express app

### Implementation for User Story 1

- [ ] T020 [P] [US1] Define Zod registration schema (`RegisterRequest`: email format, password min 8 chars + uppercase + lowercase + digit) in `src/modules/auth/auth.schema.ts` and domain types in `src/modules/auth/auth.types.ts`
- [ ] T021 [US1] Implement `register(email, password): Promise<void>` in `src/modules/auth/auth.service.ts` — normalise email to lowercase, check uniqueness via Prisma, hash with `password.util.ts`, create `User` record
- [ ] T022 [US1] Add `POST /auth/register` route to `src/modules/auth/auth.router.ts` — validate body with `RegisterRequest` Zod schema, call `auth.service.register()`, return 201 `{ message: "Account created successfully" }`
- [ ] T023 [US1] Add JSDoc to all exported functions in `auth.service.ts`, `auth.schema.ts`, `auth.types.ts`, and `auth.router.ts` touched in this story

**Checkpoint**: `npm test -- --testPathPattern=register` passes; `POST /auth/register` returns 201 for valid input and rejects duplicates/invalid input correctly.

---

## Phase 4: User Story 2 — User Login with JWT Token (Priority: P1)

**Goal**: A registered user submits credentials and receives a signed JWT (HS256, 24 h); generic errors prevent enumeration; 5 consecutive failures within 10 minutes lock the account temporarily.

**Independent Test**: `POST /auth/login` with valid credentials returns 200 with `{ token, expiresAt }`; invalid credentials return 401; sixth consecutive failure returns 429; lockout auto-lifts after 10 minutes.

### Tests for User Story 2 ✅

- [ ] T024 [P] [US2] Extend `tests/unit/auth/auth.service.test.ts` with login unit tests — cover: valid credentials return token+jti, wrong password returns `AppError(401)`, locked account returns `AppError(429)`, rate-limit counter increments on failure and resets after window
- [ ] T025 [P] [US2] Write integration tests for `POST /auth/login` in `tests/integration/auth/login.test.ts` — cover all four acceptance scenarios from spec.md including the 429 lockout scenario

### Implementation for User Story 2

- [ ] T026 [US2] Implement rate-limit middleware using `LoginAttempt` table in `src/middleware/rateLimiter.ts` — upsert `LoginAttempt` row on each request, block with 429 + `Retry-After` header if `count >= 5` and `reset_at > NOW()`, auto-reset row once window expires
- [ ] T027 [US2] Implement `login(email, password): Promise<{ token, expiresAt }>` in `src/modules/auth/auth.service.ts` — normalise email, verify password via `password.util.ts`, sign JWT via `jwt.util.ts` (include `jti`), return `AuthToken`; throw `AppError(401)` with generic message on any credential mismatch
- [ ] T028 [US2] Add `POST /auth/login` route to `src/modules/auth/auth.router.ts` — apply `rateLimiter` middleware, validate body with `LoginRequest` Zod schema, call `auth.service.login()`, return 200 `{ token, expiresAt }`
- [ ] T029 [US2] Add JSDoc to `rateLimiter.ts` and the `login()` method in `auth.service.ts`

**Checkpoint**: `npm test -- --testPathPattern=login` passes; login returns JWT; sixth failed attempt returns 429.

---

## Phase 5: User Story 3 — Session Expiry and Re-Authentication (Priority: P2)

**Goal**: Tokens are cryptographically bounded to 24 hours; explicit logout immediately invalidates the token server-side so it cannot be reused even before natural expiry.

**Independent Test**: A token accepted immediately after login is rejected after expiry (`exp` in past); `POST /auth/logout` with a valid token returns 204 and the same token is then rejected with 401.

### Tests for User Story 3 ✅

- [ ] T030 [P] [US3] Write unit tests for JWT helpers in `tests/unit/shared/jwt.util.test.ts` — cover: signed token has correct `exp` (+24 h), `jti` is a UUID, `verifyToken` throws on expired token, `verifyToken` throws on tampered signature
- [ ] T031 [P] [US3] Write integration tests for logout and token revocation in `tests/integration/auth/logout.test.ts` — cover all three acceptance scenarios: valid token accepted, expired token rejected (401), revoked token rejected after logout (401)

### Implementation for User Story 3

- [ ] T032 [US3] Implement `logout(jti, exp): Promise<void>` in `src/modules/auth/auth.service.ts` — insert a `RevokedToken` row (`jti`, `user_id`, `expires_at` copied from JWT `exp`)
- [ ] T033 [US3] Add `POST /auth/logout` route to `src/modules/auth/auth.router.ts` — apply `authenticate` middleware, call `auth.service.logout()` with `req.user.jti` and token expiry, return 204
- [ ] T034 [US3] Add expired-row cleanup helper `deleteExpiredRevokedTokens(): Promise<void>` in `src/shared/token/jwt.util.ts` — `DELETE FROM RevokedToken WHERE expires_at < NOW()`; called from `src/server.ts` on startup
- [ ] T035 [US3] Add JSDoc to `logout()` in `auth.service.ts` and `deleteExpiredRevokedTokens()` in `jwt.util.ts`

**Checkpoint**: `npm test -- --testPathPattern=logout|jwt` passes; logout invalidates token; expired tokens rejected by middleware.

---

## Phase 6: User Story 4 — Password Reset via Email (Priority: P3)

**Goal**: A user who cannot remember their password requests a reset link; the system sends a time-limited (1 h), single-use link; using it sets a new password and invalidates the link; multiple requests invalidate all previous links.

**Independent Test**: Request reset → receive email → use link → login with new password succeeds; using an expired/used/invalidated link returns 400; requesting for unknown email returns 202 (no enumeration).

### Tests for User Story 4 ✅

- [ ] T036 [P] [US4] Extend `tests/unit/auth/auth.service.test.ts` with password reset unit tests — cover: token generated and SHA-256 hashed before storage, old tokens invalidated on new request, unknown email still returns without error, expired token throws `AppError(400)`, used token throws `AppError(400)`, confirm updates password hash and marks `used_at`
- [ ] T037 [P] [US4] Write integration tests for `POST /auth/password-reset/request` and `POST /auth/password-reset/confirm` in `tests/integration/auth/password-reset.test.ts` — cover all five acceptance scenarios from spec.md (including link expiry and re-use rejection)

### Implementation for User Story 4

- [ ] T038 [P] [US4] Add Zod schemas `PasswordResetRequestBody` (email) and `PasswordResetConfirmBody` (token: string, newPassword: string with strength validation) to `src/modules/auth/auth.schema.ts`
- [ ] T039 [US4] Implement `requestPasswordReset(email): Promise<void>` in `src/modules/auth/auth.service.ts` — generate 32-byte `crypto.randomBytes` token, SHA-256 hash for storage, bulk-invalidate previous tokens for same `user_id`, insert `PasswordResetToken` (expires in 1 h), call `emailService.sendPasswordResetEmail()`; return void for unknown emails (FR-016)
- [ ] T040 [US4] Implement `confirmPasswordReset(rawToken, newPassword): Promise<void>` in `src/modules/auth/auth.service.ts` — SHA-256 hash the incoming token, look up `PasswordResetToken` by hash, verify all three validity rules (`used_at IS NULL`, `invalidated_at IS NULL`, `expires_at > NOW()`), hash new password via `password.util.ts`, update `User.password_hash`, set `PasswordResetToken.used_at = NOW()`; also add cleanup for expired `PasswordResetToken` rows in `src/server.ts` startup
- [ ] T041 [US4] Add `POST /auth/password-reset/request` (returns 202 always) and `POST /auth/password-reset/confirm` (returns 200 or 400) routes to `src/modules/auth/auth.router.ts`
- [ ] T042 [US4] Add JSDoc to `requestPasswordReset()` and `confirmPasswordReset()` in `auth.service.ts`

**Checkpoint**: `npm test -- --testPathPattern=password-reset` passes; full reset flow works end-to-end with Ethereal SMTP.

---

## Phase 7: GDPR Account Management (FR-017, FR-018, FR-019)

**Goal**: Authenticated users can export all personal data held about them and permanently delete their account; deletion soft-deletes immediately, revokes all active tokens, and zeroes personal data within 30 days.

**Independent Test**: `GET /users/me` returns `{ id, email, createdAt }` for the authenticated user; `DELETE /users/me` returns 204 and all subsequent requests with the same token return 401; no personal data appears in the database after the tombstone is applied.

### Tests for User Story 5 ✅

- [ ] T043 [P] [US5] Write unit tests for GDPR operations in `tests/unit/users/users.service.test.ts` — cover: `getProfile()` returns correct fields, `deleteAccount()` sets `deleted_at`, replaces email with tombstone, inserts `RevokedToken` for all active JTIs (cascade ensures FK cleanup)
- [ ] T044 [P] [US5] Write integration tests for GDPR endpoints in `tests/integration/users/gdpr.test.ts` — cover: `GET /users/me` returns 200 with profile; `DELETE /users/me` returns 204; token used after deletion returns 401; `GET /users/me` with deleted-account token returns 401

### Implementation for User Story 5

- [ ] T045 [P] [US5] Define user domain types in `src/modules/users/users.types.ts` (`UserProfile: { id, email, createdAt }`) and Zod schemas in `src/modules/users/users.schema.ts` (no request body schemas needed for current endpoints)
- [ ] T046 [US5] Implement `getProfile(userId): Promise<UserProfile>` in `src/modules/users/users.service.ts` — query `User` by id, assert `deleted_at IS NULL`, return `{ id, email, createdAt }`
- [ ] T047 [US5] Implement `deleteAccount(userId, activeJti): Promise<void>` in `src/modules/users/users.service.ts` — set `User.deleted_at = NOW()`, replace `email` with tombstone `DELETED-<id>@removed`, clear `password_hash`; insert `RevokedToken` for `activeJti` so the caller's token is immediately invalidated (cascade FK handles other active tokens on hard-delete)
- [ ] T048 [US5] Add `GET /users/me` (returns 200 `UserProfile`) and `DELETE /users/me` (returns 204) routes to `src/modules/users/users.router.ts` — both protected by `authenticate` middleware; mount router in `src/app.ts` at `/users`
- [ ] T049 [US5] Add JSDoc to all exports in `users.service.ts`, `users.types.ts`, and `users.router.ts`

**Checkpoint**: `npm test -- --testPathPattern=gdpr` passes; authenticated user can export profile and delete account; deleted-account token is rejected.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, hardening, and final validation across all implemented stories.

- [ ] T050 [P] Verify TypeScript compiles with zero errors: `npx tsc --noEmit` — resolve any strict-mode violations or implicit `any` in business logic
- [ ] T051 [P] Verify Jest coverage meets the 80% threshold: `npx jest --coverage` — check branches, lines, functions, statements for all `src/modules/**` and `src/shared/**` files
- [ ] T052 [P] Run ESLint across `src/` and resolve all violations: `npx eslint src --ext .ts`
- [ ] T053 [P] Security review checklist: confirm `JWT_SECRET` is only read from `env.ts` (never hardcoded), bcrypt cost is 12, all Prisma queries use parameterized inputs (no raw string interpolation), no stack traces leaked in production error responses, SMTP credentials come from env only
- [ ] T054 [P] Verify all exported production APIs and non-obvious helpers carry JSDoc across `src/modules/` and `src/shared/`
- [ ] T055 Follow the `quickstart.md` validation: clone fresh, `npm install`, configure `.env`, `npx prisma migrate dev`, `npm run dev` — confirm server starts and all routes respond as documented in `contracts/openapi.yaml`
- [ ] T056 [P] Update `specs/001-user-auth-system/quickstart.md` with any corrections discovered during T055 validation

**Checkpoint**: All tests pass, coverage ≥ 80%, TypeScript compiles clean, quickstart works end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └─▶ Phase 2 (Foundational) — BLOCKS all stories
            ├─▶ Phase 3 (US1 Registration) ◀── MVP
            │       └─▶ Phase 4 (US2 Login)  [may start in parallel with US1 after Phase 2]
            │               └─▶ Phase 5 (US3 Session) [depends on Login for token generation]
            ├─▶ Phase 6 (US4 Password Reset) [can start after Phase 2; independent of US2/US3]
            └─▶ Phase 7 (GDPR)              [can start after Phase 2; independent of US2–US4]
```

### User Story Dependencies

| Story | Phase | Priority | Depends On | Can Parallel With |
|-------|-------|----------|------------|-------------------|
| US1 Registration | 3 | P1 | Phase 2 | US4, US5 |
| US2 Login | 4 | P1 | Phase 2 | US4, US5 |
| US3 Session/Logout | 5 | P2 | Phase 2 + US2 JWT tokens | US4, US5 |
| US4 Password Reset | 6 | P3 | Phase 2 | US1, US2, US5 |
| US5 GDPR | 7 | FR | Phase 2 | US1, US4 |

### Within Each User Story

1. Tests written first (should FAIL before implementation)
2. Schemas and types → Services → Routes
3. JSDoc added immediately after implementation
4. Story checkpoint verified before moving on

### Parallel Opportunities

**Phase 1**: T003, T004, T005 are fully parallel after T001–T002.  
**Phase 2**: T010, T011, T012, T013 are fully parallel after T009. T014–T017 must follow.  
**Phase 3–7**: After Phase 2 completes, tests and schema/type tasks within each story are parallel. Stories US1, US4, and US5 can be worked in parallel by different engineers; US3 requires US2 to be complete first.  
**Phase 8**: T050, T051, T052, T053, T054, T056 are all parallel.

---

## Implementation Strategy

### MVP Scope (Ship First)

Implement **Phase 1 → Phase 2 → Phase 3 (US1)** to deliver a working registration endpoint. This is the minimum deliverable that onboards a new user and validates the full stack (TypeScript, Prisma, PostgreSQL, Zod, Express).

### Incremental Delivery Order

1. **MVP**: Registration (US1) — validates the entire stack end-to-end
2. **Core Auth**: Login + JWT (US2) — unlocks all protected endpoints
3. **Session Safety**: Logout + Expiry (US3) — completes the session lifecycle
4. **Account Recovery**: Password Reset (US4) — handles the exceptional path
5. **Compliance**: GDPR Account Management (US5) — fulfils regulatory requirements
6. **Polish**: All cross-cutting quality gates (Phase 8)

Each increment is independently testable and deployable.
