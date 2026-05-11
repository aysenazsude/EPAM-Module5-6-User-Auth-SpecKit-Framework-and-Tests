# Tasks: User Authentication System

**Input**: Design documents from `/specs/001-user-auth-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/openapi.yaml ✅, quickstart.md ✅

**Tests**: Required — engineering constraints EC-004 and EC-005 plus constitution TP-I..TP-VIII mandate strict TDD (RED-GREEN-REFACTOR), Testing Pyramid distribution (~70% unit / ~20% integration / ~10% E2E), and quality gates: line coverage ≥ 80%, branch coverage ≥ 75%, mutation score ≥ 75% (Stryker).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Within every story, tests are written **before** implementation and ordered **unit → integration**, mirroring the pyramid base-up. End-to-end tests for critical user journeys live in a dedicated terminal phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every implementation task

## Path Conventions

Single-project layout (see plan.md): `src/`, `tests/`, `prisma/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Node.js/TypeScript project and all tooling so any subsequent phase can start immediately.

- [X] T001 Initialize Node.js project and install all production dependencies: `npm init -y && npm install express @prisma/client jsonwebtoken bcrypt nodemailer express-rate-limit zod`
- [X] T002 Install all dev dependencies (test toolchain per TP-VIII): `npm install --save-dev typescript @types/node @types/express @types/jsonwebtoken @types/bcrypt @types/nodemailer ts-node ts-jest jest@29 supertest @types/supertest @types/jest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-jest @stryker-mutator/core @stryker-mutator/jest-runner husky lint-staged`
- [X] T003 [P] Configure TypeScript with `strict: true` in `tsconfig.json` (target ES2022, moduleResolution node16, outDir dist, rootDir src)
- [X] T004 [P] Configure Jest in `jest.config.ts` with `ts-jest` preset, `clearMocks: true` (TP-V), test roots `tests/unit`, `tests/integration`, `tests/e2e`, and coverage thresholds **lines ≥ 80, branches ≥ 75, functions ≥ 80, statements ≥ 80** (TP-II)
- [X] T004a [P] Configure ESLint in `.eslintrc.cjs` with `@typescript-eslint/recommended` + `eslint-plugin-jest` rules `jest/valid-expect` and `jest/no-identical-title` (TP-VIII)
- [X] T004b [P] Configure Stryker in `stryker.conf.json` with `@stryker-mutator/jest-runner`, mutate `src/modules/**` and `src/shared/**`, mutation score threshold **break: 75** (TP-II / TP-VII)
- [X] T004c [P] Configure husky + lint-staged pre-commit hook (TP-VIII): runs `npx tsc --noEmit` → `npx eslint . --max-warnings 0` → `npx jest tests/unit --passWithNoTests`
- [X] T005 [P] Create `.env.example` with all required variables: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- [X] T005a [P] Scaffold test directory layout per TP-III: create empty `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/fixtures/`, `tests/helpers/` with `.gitkeep`

**Checkpoint**: `npx tsc --noEmit` passes; `npx eslint . --max-warnings 0` passes; `npx jest --passWithNoTests` exits 0; pre-commit hook blocks bad commits.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on. No story work begins until this phase is complete.

**⚠️ CRITICAL**: Phases 3–7 depend on this phase being fully complete.

- [X] T006 Create validated environment config using Zod in `src/config/env.ts` (parse and export `PORT`, `DATABASE_URL`, `JWT_SECRET`, `SMTP_*`; throw on startup if any required var is missing)
- [X] T007 Define Prisma schema in `prisma/schema.prisma` with four models: `User` (id, email, password_hash, status enum, lock_expires_at, created_at, deleted_at), `PasswordResetToken` (id, user_id FK, token_hash, expires_at, used_at, invalidated_at, created_at), `RevokedToken` (id, jti unique indexed, user_id FK, expires_at, revoked_at), `LoginAttempt` (key PK, count, reset_at)
- [X] T008 Run `npx prisma migrate dev --name init` to generate the initial migration and Prisma client (requires `DATABASE_URL` to be set)
- [X] T009 Create Prisma client singleton in `src/config/db.ts` (single `PrismaClient` instance, reused across modules)
- [X] T010 [P] Create typed `AppError` class in `src/shared/errors/AppError.ts` (extends `Error`; fields: `statusCode: number`, `code: string`, `isOperational: boolean`)
- [X] T011 [P] Create bcrypt hash and compare helpers in `src/shared/password/password.util.ts` (`hashPassword(plain: string): Promise<string>` at cost 12, `verifyPassword(plain, hash): Promise<boolean>`)
- [X] T012 [P] Create JWT sign and verify helpers with `jti` support in `src/shared/token/jwt.util.ts` (`signToken(userId): { token, jti, expiresAt }` — 24 h expiry; `verifyToken(token): JwtPayload`)
- [X] T013 [P] Define `IEmailService` interface and Nodemailer adapter in `src/shared/email/email.types.ts` and `src/shared/email/email.service.ts` (`sendPasswordResetEmail(to, resetLink): Promise<void>`)
- [X] T014 Implement centralised error-handler middleware in `src/middleware/errorHandler.ts` (catch `AppError` and generic errors; serialize to `{ error, details? }` JSON; never leak stack traces in production)
- [X] T015 Implement JWT authentication middleware in `src/middleware/authenticate.ts` (verify token via `jwt.util.ts`, look up `jti` in `RevokedToken` table, attach `req.user = { userId, jti }`, return 401 on failure)
- [X] T016 Create Express app factory in `src/app.ts` (register `express.json()`, rate-limiter, auth router at `/auth`, users router at `/users`, error handler; no side effects — returns `app` for testing)
- [X] T017 Create server entry point in `src/server.ts` (call `app.ts` factory, run startup cleanup for expired `RevokedToken` and `PasswordResetToken` rows, start listening on `PORT`)

**Checkpoint**: `npx ts-node src/server.ts` starts without errors; `GET /` returns 404 (no routes yet — expected).

---

## Phase 3: User Story 1 — New User Registration (Priority: P1) 🎯 MVP

**Goal**: A new visitor submits email + password and the system creates an immediately-active account; duplicate or invalid submissions are rejected with clear errors.

**Independent Test**: `POST /auth/register` with valid credentials returns 201; duplicate email returns 409; invalid email returns 422; weak password returns 422. No other story needs to be implemented.

### Tests for User Story 1 ✅ (TDD — RED phase BEFORE any implementation)

Order is pyramid base-up: unit tests first, then integration. All tests MUST fail before T020 begins (TP-I RED).

- [X] T017a [P] [US1] Add user fixture factory `createTestUser(overrides?)` in `tests/fixtures/user.fixture.ts` and Prisma repository fake in `tests/helpers/prisma-fake.ts` (TP-VI)
- [X] T018 [P] [US1] **Unit** — Write registration unit tests in `tests/unit/modules/auth/auth.service.test.ts` (mirrors `src/modules/auth/auth.service.ts` per TP-III); AAA structure (TP-V); cover: happy path (user created, password hashed), duplicate email throws `AppError(409)`, invalid email format throws `AppError(422)`, weak password throws `AppError(422)`
- [X] T019 [US1] **Integration** — Write Supertest tests for `POST /auth/register` in `tests/integration/auth/register.test.ts` covering all four acceptance scenarios from spec.md against the Express app instance

### Implementation for User Story 1

- [X] T020 [P] [US1] Define Zod registration schema (`RegisterRequest`: email format, password min 8 chars + uppercase + lowercase + digit) in `src/modules/auth/auth.schema.ts` and domain types in `src/modules/auth/auth.types.ts`
- [X] T021 [US1] Implement `register(email, password): Promise<void>` in `src/modules/auth/auth.service.ts` — normalise email to lowercase, check uniqueness via Prisma, hash with `password.util.ts`, create `User` record
- [X] T022 [US1] Add `POST /auth/register` route to `src/modules/auth/auth.router.ts` — validate body with `RegisterRequest` Zod schema, call `auth.service.register()`, return 201 `{ message: "Account created successfully" }`
- [X] T023 [US1] Add JSDoc to all exported functions in `auth.service.ts`, `auth.schema.ts`, `auth.types.ts`, and `auth.router.ts` touched in this story

**Checkpoint**: `npm test -- --testPathPattern=register` passes; `POST /auth/register` returns 201 for valid input and rejects duplicates/invalid input correctly.

---

## Phase 4: User Story 2 — User Login with JWT Token (Priority: P1)

**Goal**: A registered user submits credentials and receives a signed JWT (HS256, 24 h); generic errors prevent enumeration; 5 consecutive failures within 10 minutes lock the account temporarily.

**Independent Test**: `POST /auth/login` with valid credentials returns 200 with `{ token, expiresAt }`; invalid credentials return 401; sixth consecutive failure returns 429; lockout auto-lifts after 10 minutes.

### Tests for User Story 2 ✅ (TDD — unit before integration)

- [X] T023a [P] [US2] Add `createTestSession(overrides?)` fixture in `tests/fixtures/session.fixture.ts` (TP-VI)
- [X] T024 [P] [US2] **Unit** — Extend `tests/unit/modules/auth/auth.service.test.ts` with login unit tests; use `jest.useFakeTimers()` for the lockout window (TP-VI); cover: valid credentials return token+jti, wrong password returns `AppError(401)`, locked account returns `AppError(429)`, rate-limit counter increments on failure and resets after window
- [X] T025 [US2] **Integration** — Write Supertest tests for `POST /auth/login` in `tests/integration/auth/login.test.ts` covering all four acceptance scenarios including 429 lockout

### Implementation for User Story 2

- [X] T026 [US2] Implement rate-limit middleware using `LoginAttempt` table in `src/middleware/rateLimiter.ts` — upsert `LoginAttempt` row on each request, block with 429 + `Retry-After` header if `count >= 5` and `reset_at > NOW()`, auto-reset row once window expires
- [X] T027 [US2] Implement `login(email, password): Promise<{ token, expiresAt }>` in `src/modules/auth/auth.service.ts` — normalise email, verify password via `password.util.ts`, sign JWT via `jwt.util.ts` (include `jti`), return `AuthToken`; throw `AppError(401)` with generic message on any credential mismatch
- [X] T028 [US2] Add `POST /auth/login` route to `src/modules/auth/auth.router.ts` — apply `rateLimiter` middleware, validate body with `LoginRequest` Zod schema, call `auth.service.login()`, return 200 `{ token, expiresAt }`
- [X] T029 [US2] Add JSDoc to `rateLimiter.ts` and the `login()` method in `auth.service.ts`

**Checkpoint**: `npm test -- --testPathPattern=login` passes; login returns JWT; sixth failed attempt returns 429.

---

## Phase 5: User Story 3 — Session Expiry and Re-Authentication (Priority: P2)

**Goal**: Tokens are cryptographically bounded to 24 hours; explicit logout immediately invalidates the token server-side so it cannot be reused even before natural expiry.

**Independent Test**: A token accepted immediately after login is rejected after expiry (`exp` in past); `POST /auth/logout` with a valid token returns 204 and the same token is then rejected with 401.

### Tests for User Story 3 ✅ (TDD — unit before integration)

- [X] T030 [P] [US3] **Unit** — Write JWT helper unit tests in `tests/unit/shared/token/jwt.util.test.ts` (mirrors `src/shared/token/jwt.util.ts`); use `jest.useFakeTimers()` to control `exp` (TP-VI); cover: signed token has correct `exp` (+24 h), `jti` is a UUID, `verifyToken` throws on expired token, `verifyToken` throws on tampered signature
- [X] T030a [P] [US3] **Unit** — Add logout unit tests to `tests/unit/modules/auth/auth.service.test.ts` covering revoked-token insertion
- [X] T031 [US3] **Integration** — Write Supertest tests for logout/revocation in `tests/integration/auth/logout.test.ts` covering all three acceptance scenarios

### Implementation for User Story 3

- [X] T032 [US3] Implement `logout(jti, exp): Promise<void>` in `src/modules/auth/auth.service.ts` — insert a `RevokedToken` row (`jti`, `user_id`, `expires_at` copied from JWT `exp`)
- [X] T033 [US3] Add `POST /auth/logout` route to `src/modules/auth/auth.router.ts` — apply `authenticate` middleware, call `auth.service.logout()` with `req.user.jti` and token expiry, return 204
- [X] T034 [US3] Add expired-row cleanup helper `deleteExpiredRevokedTokens(): Promise<void>` in `src/shared/token/jwt.util.ts` — `DELETE FROM RevokedToken WHERE expires_at < NOW()`; called from `src/server.ts` on startup
- [X] T035 [US3] Add JSDoc to `logout()` in `auth.service.ts` and `deleteExpiredRevokedTokens()` in `jwt.util.ts`

**Checkpoint**: `npm test -- --testPathPattern=logout|jwt` passes; logout invalidates token; expired tokens rejected by middleware.

---

## Phase 6: User Story 4 — Password Reset via Email (Priority: P3)

**Goal**: A user who cannot remember their password requests a reset link; the system sends a time-limited (1 h), single-use link; using it sets a new password and invalidates the link; multiple requests invalidate all previous links.

**Independent Test**: Request reset → receive email → use link → login with new password succeeds; using an expired/used/invalidated link returns 400; requesting for unknown email returns 202 (no enumeration).

### Tests for User Story 4 ✅ (TDD — unit before integration)

- [X] T035a [P] [US4] Add `setupMockEmailService()` fixture in `tests/fixtures/email.fixture.ts` returning a Jest-mocked `IEmailService` (TP-VI)
- [X] T036 [P] [US4] **Unit** — Extend `tests/unit/modules/auth/auth.service.test.ts` with password-reset unit tests; cover: token generated and SHA-256 hashed before storage, old tokens invalidated on new request, unknown email returns without error, expired token throws `AppError(400)`, used token throws `AppError(400)`, confirm updates password hash and marks `used_at`
- [X] T037 [US4] **Integration** — Write Supertest tests for `POST /auth/password-reset/request` and `POST /auth/password-reset/confirm` in `tests/integration/auth/password-reset.test.ts` covering all five acceptance scenarios

### Implementation for User Story 4

- [X] T038 [P] [US4] Add Zod schemas `PasswordResetRequestBody` (email) and `PasswordResetConfirmBody` (token: string, newPassword: string with strength validation) to `src/modules/auth/auth.schema.ts`
- [X] T039 [US4] Implement `requestPasswordReset(email): Promise<void>` in `src/modules/auth/auth.service.ts` — generate 32-byte `crypto.randomBytes` token, SHA-256 hash for storage, bulk-invalidate previous tokens for same `user_id`, insert `PasswordResetToken` (expires in 1 h), call `emailService.sendPasswordResetEmail()`; return void for unknown emails (FR-016)
- [X] T040 [US4] Implement `confirmPasswordReset(rawToken, newPassword): Promise<void>` in `src/modules/auth/auth.service.ts` — SHA-256 hash the incoming token, look up `PasswordResetToken` by hash, verify all three validity rules (`used_at IS NULL`, `invalidated_at IS NULL`, `expires_at > NOW()`), hash new password via `password.util.ts`, update `User.password_hash`, set `PasswordResetToken.used_at = NOW()`; also add cleanup for expired `PasswordResetToken` rows in `src/server.ts` startup
- [X] T041 [US4] Add `POST /auth/password-reset/request` (returns 202 always) and `POST /auth/password-reset/confirm` (returns 200 or 400) routes to `src/modules/auth/auth.router.ts`
- [X] T042 [US4] Add JSDoc to `requestPasswordReset()` and `confirmPasswordReset()` in `auth.service.ts`

**Checkpoint**: `npm test -- --testPathPattern=password-reset` passes; full reset flow works end-to-end with Ethereal SMTP.

---

## Phase 7: GDPR Account Management (FR-017, FR-018, FR-019)

**Goal**: Authenticated users can export all personal data held about them and permanently delete their account; deletion soft-deletes immediately, revokes all active tokens, and zeroes personal data within 30 days.

**Independent Test**: `GET /users/me` returns `{ id, email, createdAt }` for the authenticated user; `DELETE /users/me` returns 204 and all subsequent requests with the same token return 401; no personal data appears in the database after the tombstone is applied.

### Tests for User Story 5 ✅ (TDD — unit before integration)

- [X] T043 [P] [US5] **Unit** — Write GDPR unit tests in `tests/unit/modules/users/users.service.test.ts` (mirrors `src/modules/users/users.service.ts` per TP-III); cover: `getProfile()` returns correct fields, `deleteAccount()` sets `deleted_at`, replaces email with tombstone, inserts `RevokedToken` for active JTI
- [X] T044 [US5] **Integration** — Write Supertest tests for GDPR endpoints in `tests/integration/users/gdpr.test.ts` covering all four scenarios above

### Implementation for User Story 5

- [X] T045 [P] [US5] Define user domain types in `src/modules/users/users.types.ts` (`UserProfile: { id, email, createdAt }`) and Zod schemas in `src/modules/users/users.schema.ts` (no request body schemas needed for current endpoints)
- [X] T046 [US5] Implement `getProfile(userId): Promise<UserProfile>` in `src/modules/users/users.service.ts` — query `User` by id, assert `deleted_at IS NULL`, return `{ id, email, createdAt }`
- [X] T047 [US5] Implement `deleteAccount(userId, activeJti): Promise<void>` in `src/modules/users/users.service.ts` — set `User.deleted_at = NOW()`, replace `email` with tombstone `DELETED-<id>@removed`, clear `password_hash`; insert `RevokedToken` for `activeJti` so the caller's token is immediately invalidated (cascade FK handles other active tokens on hard-delete)
- [X] T048 [US5] Add `GET /users/me` (returns 200 `UserProfile`) and `DELETE /users/me` (returns 204) routes to `src/modules/users/users.router.ts` — both protected by `authenticate` middleware; mount router in `src/app.ts` at `/users`
- [X] T049 [US5] Add JSDoc to all exports in `users.service.ts`, `users.types.ts`, and `users.router.ts`

**Checkpoint**: `npm test -- --testPathPattern=gdpr` passes; authenticated user can export profile and delete account; deleted-account token is rejected.

---

## Phase 8: End-to-End Critical Journey (TP-II ~10%)

**Purpose**: Cover the single critical user journey end-to-end. Per TP-II, E2E tests are intentionally minimal (~10% of suite) and live in `tests/e2e/`.

- [X] T049a **E2E** — Write `tests/e2e/auth-flow.spec.ts` (TP-IV `.spec.ts` naming): full journey **register → login → authenticated `GET /users/me` → logout → verify revoked token rejected** via Supertest against the Express app instance

**Checkpoint**: `npx jest tests/e2e` passes; suite runs in < 10 s.

---

## Phase 9: Polish & Cross-Cutting Quality Gates

**Purpose**: Enforce all constitution gates (TP-II, TP-VII, TP-VIII) and final validation.

- [X] T050 [P] Verify TypeScript compiles with zero errors: `npx tsc --noEmit` — resolve any strict-mode violations or implicit `any` in business logic
- [X] T051 [P] Verify Jest coverage meets thresholds: `npx jest --coverage` — **lines ≥ 80%, branches ≥ 75%** (TP-II) for `src/modules/**` and `src/shared/**`
- [X] T051a [P] Verify mutation score: `npx stryker run` — **mutation score ≥ 75%** (TP-II / TP-VII); strengthen tests for any surviving mutants
- [X] T051b [P] Verify pyramid distribution by counting test files: ~70% unit / ~20% integration / ~10% E2E (TP-II); rebalance if skewed
- [X] T052 [P] Run ESLint with zero warnings: `npx eslint . --max-warnings 0` (TP-VIII); confirm `jest/valid-expect` and `jest/no-identical-title` are active
- [X] T052a [P] Test-quality audit (TP-VII): no tautological assertions; every `it` exercises one behaviour; unit tests < 1 s, integration tests < 5 s; no `beforeAll` in unit tests; mocks reset via `clearMocks: true`
- [X] T053 [P] Security review checklist: confirm `JWT_SECRET` is only read from `env.ts` (never hardcoded), bcrypt cost is 12, all Prisma queries use parameterized inputs (no raw string interpolation), no stack traces leaked in production error responses, SMTP credentials come from env only
- [X] T054 [P] Verify all exported production APIs and non-obvious helpers carry JSDoc (purpose, params, returns, throws, side effects) across `src/modules/` and `src/shared/`
- [X] T055 Follow the `quickstart.md` validation: clone fresh, `npm install`, configure `.env`, `npx prisma migrate dev`, `npm run dev` — confirm server starts and all routes respond as documented in `contracts/openapi.yaml`
- [X] T056 [P] Update `specs/001-user-auth-system/quickstart.md` with any corrections discovered during T055 validation

**Checkpoint**: All five CI gates pass — `tsc --noEmit` → `eslint --max-warnings 0` → `npm test` → `jest --coverage` (line ≥ 80, branch ≥ 75) → `stryker run` (mutation ≥ 75).

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

### Within Each User Story (Pyramid Base-Up, TDD Strict)

1. **Fixtures/helpers** scaffolded (TP-VI)
2. **Unit tests** written first — must FAIL (RED, TP-I)
3. **Integration tests** written next — must FAIL
4. **Implementation**: Schemas/types → Services → Routes (GREEN)
5. **Refactor** with all tests green (TP-I)
6. JSDoc added immediately after implementation
7. Story checkpoint verified before moving on

E2E tests (Phase 8) are written **after** all stories are integration-green, since they exercise the full assembled journey.

### Parallel Opportunities

**Phase 1**: T003, T004, T004a, T004b, T004c, T005, T005a are fully parallel after T001–T002.  
**Phase 2**: T010, T011, T012, T013 are fully parallel after T009. T014–T017 must follow.  
**Phase 3–7**: After Phase 2 completes, fixtures and unit tests within each story are parallel; integration tests follow unit tests. Stories US1, US4, and US5 can be worked in parallel by different engineers; US3 requires US2 to be complete first.  
**Phase 8**: Single E2E task; sequential.  
**Phase 9**: T050, T051, T051a, T051b, T052, T052a, T053, T054, T056 are all parallel.

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
