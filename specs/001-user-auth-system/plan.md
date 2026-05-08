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

**Language/Version**: TypeScript 5.x (Node.js 20 LTS), `strict: true`  
**Primary Dependencies**: Express 4.x, Prisma ORM, jsonwebtoken, bcrypt, Zod, nodemailer, express-rate-limit  
**Storage**: PostgreSQL 16 (via Prisma Migrate for schema management)  
**Testing**: Jest 29 + Supertest (unit + integration); 80% business-logic coverage gate  
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
| **III. JSDoc Documentation** | ✅ PASS | All exported services, middleware, and non-obvious helpers will carry JSDoc |
| **IV. Testing Pyramid** | ✅ PASS | Many unit tests (services, validators, helpers); fewer Supertest integration tests; no dedicated e2e layer needed |
| **V. Incremental Simplicity** | ✅ PASS | Prisma for type-safe DB access; no unnecessary layers; complexity justified in research.md |

**Business-Logic Coverage Gate**: Jest `--coverage` configured with `branches/lines/functions/statements` threshold at **80%**. Build fails below threshold.

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
├── unit/
│   ├── auth/
│   │   └── auth.service.test.ts
│   └── shared/
│       ├── password.util.test.ts
│       └── jwt.util.test.ts
└── integration/
    ├── auth/
    │   ├── register.test.ts
    │   ├── login.test.ts
    │   ├── logout.test.ts
    │   └── password-reset.test.ts
    └── users/
        └── gdpr.test.ts
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
