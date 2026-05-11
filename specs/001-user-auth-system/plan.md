# Implementation Plan: User Authentication System

**Branch**: `001-user-auth-system` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-user-auth-system/spec.md`

## Summary

Build a production-ready user authentication REST API using **Express.js with TypeScript**,
**PostgreSQL** for persistence, **bcrypt** for password hashing, and **JWT (HS256)** for
stateless session tokens. The system covers registration, login, logout, password reset
via email, session expiry (24 h), GDPR erasure/portability, and rate-limited login
protection — all tested with **Jest + Supertest** following the Testing Pyramid.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 LTS), `strict: true` (target ES2022, moduleResolution node16)  
**Primary Dependencies**: Express 4.x, Prisma ORM, jsonwebtoken, bcrypt, Zod, nodemailer, express-rate-limit  
**Storage**: PostgreSQL 16 (via Prisma Migrate for schema management)  
**Testing**: Jest 29 + ts-jest + Supertest across unit / integration / e2e layers; Stryker Mutator (`@stryker-mutator/core` + `@stryker-mutator/jest-runner`) for mutation testing. Quality gates: line coverage ≥ 80%, branch coverage ≥ 75%, mutation score ≥ 75%. Static analysis: `tsc --noEmit` zero errors + ESLint (`@typescript-eslint/recommended` + `eslint-plugin-jest`) with `--max-warnings 0`. TDD (RED-GREEN-REFACTOR) mandatory per TP-I.  
**Target Platform**: Linux server (containerisable, Docker-friendly)  
**Project Type**: Web service (REST API)  
**Performance Goals**: Login ≤ 3 s p95 at 100 concurrent users; registration confirmation < 2 min  
**Constraints**: < 200 ms p95 for token-validation middleware; GDPR right to erasure + portability  
**Scale/Scope**: 100 concurrent users (v1 baseline); stateless API scales horizontally

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|---------|
| **I. Clean Code** | ✅ PASS | Modules split by domain (`auth`, `users`, `shared`); single-responsibility services; no speculative abstractions |
| **II. TypeScript Strict Mode** | ✅ PASS | `tsconfig.json` will enable `strict: true`; `any` prohibited in business logic |
| **III. JSDoc Documentation** | ✅ PASS | All exported services, middleware, and non-obvious helpers will carry JSDoc (purpose, params, returns, throws, side effects) |
| **IV. Testing Pyramid** | ✅ PASS | Distribution targets ~70% unit / ~20% integration / ~10% e2e; critical-path e2e flows (registration → login → authenticated request → logout) under `tests/e2e/` via Supertest against the Express app instance |
| **V. Incremental Simplicity** | ✅ PASS | Prisma for type-safe DB access; no unnecessary layers; complexity justified in research.md |

**Testing Principles Gate (TP-I … TP-VIII)**:

- **TP-I (TDD)**: Every production change starts with a failing test derived from spec/acceptance scenarios. Tasks ordered tests-first.
- **TP-II (Coverage & static analysis)**: Jest `--coverage` thresholds set to **lines ≥ 80%, branches ≥ 75%, functions ≥ 80%, statements ≥ 80%**. Stryker mutation score ≥ **75%**. `tsc --noEmit` and `eslint --max-warnings 0` MUST pass.
- **TP-III (Layout)**: `tests/unit/**` mirrors `src/**` 1:1; `tests/integration/**` grouped by feature; `tests/e2e/**` grouped by user journey; fixtures under `tests/fixtures/`; shared helpers under `tests/helpers/`.
- **TP-IV (Naming)**: `{module}.test.ts` (unit/integration), `{journey}.spec.ts` (e2e); `it('should <outcome> when <condition>', ...)`; max two `describe` nesting levels.
- **TP-V (Anatomy)**: AAA structure with blank lines between phases; `clearMocks: true` in Jest config; `beforeAll` prohibited in unit tests.
- **TP-VI (Doubles)**: Mock external services (nodemailer, third-party APIs); fake the Prisma layer in unit tests via a hand-rolled repository implementing the same interface; stub time via `jest.useFakeTimers()`. Do NOT mock owned services/utils, pure functions, Prisma types, or Zod schemas.
- **TP-VII (Quality)**: No tautological assertions; oracles derived from spec; one behaviour per `it`; unit tests < 1 s, integration tests < 5 s; deterministic.
- **TP-VIII (Tooling)**: Pre-commit hook via husky + lint-staged runs `tsc --noEmit` → `eslint --max-warnings 0` → `jest tests/unit --passWithNoTests`. CI pipeline runs `tsc --noEmit` → `eslint` → `npm test` → `jest --coverage` → `stryker run`; all five steps MUST pass before merge.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth-system/
├── plan.md          # This file
├── research.md      # Phase 0 output
├── data-model.md    # Phase 1 output
├── quickstart.md    # Phase 1 output
├── contracts/       # Phase 1 output
│   └── openapi.yaml
└── tasks.md         # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── env.ts              # Validated environment variable loading (Zod)
│   └── db.ts               # Prisma client singleton
├── middleware/
│   ├── authenticate.ts     # JWT verification middleware
│   ├── rateLimiter.ts      # express-rate-limit configuration
│   └── errorHandler.ts     # Centralised error handler
├── modules/
│   ├── auth/
│   │   ├── auth.router.ts  # Route definitions for /auth/*
│   │   ├── auth.service.ts # Business logic: register, login, logout, password reset
│   │   ├── auth.schema.ts  # Zod request validation schemas
│   │   └── auth.types.ts   # Domain types for auth module
│   └── users/
│       ├── users.router.ts # Route definitions for /users/*
│       ├── users.service.ts# Business logic: GDPR export, account deletion
│       ├── users.schema.ts # Zod schemas for user routes
│       └── users.types.ts  # Domain types for users module
├── shared/
│   ├── email/
│   │   ├── email.service.ts  # Nodemailer adapter behind IEmailService interface
│   │   └── email.types.ts
│   ├── password/
│   │   └── password.util.ts  # bcrypt hash + compare helpers
│   ├── token/
│   │   └── jwt.util.ts       # Sign + verify JWT helpers
│   └── errors/
│       └── AppError.ts       # Typed application error class
├── app.ts                    # Express app factory (no side effects, testable)
└── server.ts                 # Entry point: create app, start listening

prisma/
├── schema.prisma             # Prisma data model
└── migrations/               # Auto-generated migration files

tests/
├── unit/                              # mirrors src/ 1:1 (TP-III)
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.service.test.ts
│   │   └── users/
│   │       └── users.service.test.ts
│   └── shared/
│       ├── password/
│       │   └── password.util.test.ts
│       └── token/
│           └── jwt.util.test.ts
├── integration/                       # grouped by feature (TP-III)
│   ├── auth/
│   │   ├── register.test.ts
│   │   ├── login.test.ts
│   │   ├── logout.test.ts
│   │   └── password-reset.test.ts
│   └── users/
│       └── gdpr.test.ts
├── e2e/                               # critical user journeys only (TP-II ~10%)
│   └── auth-flow.spec.ts              # register → login → authenticated request → logout
├── fixtures/                          # factory functions (TP-VI)
│   ├── user.fixture.ts                # createTestUser(overrides?)
│   ├── session.fixture.ts             # createTestSession(overrides?)
│   └── email.fixture.ts               # setupMockEmailService()
└── helpers/                           # shared test utilities (no business logic)
    └── prisma-fake.ts                 # hand-rolled in-memory repository fake
```

**Structure Decision**: Single-project layout (Option 1). The feature is a standalone API
service with no separate frontend. Domain modules (`auth`, `users`) own their own routers,
services, and types; `shared/` holds cross-cutting utilities. Prisma replaces manual SQL
for type safety and migration management.

## Complexity Tracking

No constitution violations requiring justification.

| Decision | Rationale |
|----------|-----------|
| Prisma ORM instead of raw `pg` | Generates TypeScript types from schema; built-in migration runner; reduces boilerplate without adding a heavyweight framework |
| DB-backed token denylist (revoked_tokens table) | Keeps infrastructure simple (no Redis dependency for v1); rows auto-cleanup via scheduled query or cron |
| Hash password-reset tokens before storage | Prevents token theft from DB read; mirrors standard practice (same as bcrypt for passwords) |
| express-rate-limit with PostgreSQL store (`rate-limit-postgresql`) | Shared state across Node processes without Redis; acceptable latency at 100 concurrent users |
| Hand-rolled Prisma repository fake for unit tests | TP-VI requires fakes (not mocks) for the DB layer in unit tests; keeps unit tests < 1 s and avoids coupling to Prisma internals |
| Stryker Mutator added to CI | TP-II / TP-VII require mutation score ≥ 75% to validate test effectiveness beyond line/branch coverage |
| Dedicated `tests/e2e/auth-flow.spec.ts` via Supertest | TP-II requires ~10% e2e coverage of critical user journeys; Supertest against the Express app instance avoids browser tooling for this REST-only API |
