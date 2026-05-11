<!--
Sync Impact Report
- Version change: 1.3.0 -> 1.4.0 (MINOR: TP-VIII Tools & Frameworks added)
- Version change: 1.4.0 -> 1.4.1 (PATCH: Engineering Standards and Development Workflow
  wording aligned with TP-II/TP-VIII thresholds; plan-template.md updated to match)
- Modified principles: None
- Added sections: TP-VIII Tools & Frameworks (static analysis, test toolchain, commands, pre-commit hook, CI/CD pipeline)
- Clarified sections: Engineering Standards (coverage thresholds), Development Workflow (PR evidence list)
- Removed sections: None
- Templates reviewed and confirmed consistent (2026-05-11):
	- ✅ updated: .specify/templates/plan-template.md
	  (Constitution Check gate covers all 5 core principles; Business Logic Coverage gate
	   updated to reference line >= 80%, branch >= 75%, mutation >= 75% per TP-II/TP-VIII)
	- ✅ aligned: .specify/templates/spec-template.md
	  (EC-001..EC-005 map 1:1 to principles I..V; TP-I/TP-II supplement EC-004/EC-005)
	- ✅ aligned: .specify/templates/tasks-template.md
	  (test-first tasks and JSDoc items present; TP-I TDD mandate reinforces write-tests-
	   first ordering; TP-II thresholds match existing gates)
	- ✅ aligned: .specify/templates/checklist-template.md
	  (generic template; testing principles enforced at generation time)
	- ✅ reviewed: .specify/extensions/git/commands/*.md
	  (no CLAUDE-specific or outdated agent references found)
- Tech stack context: TypeScript 5.x / Node.js 20 LTS, Jest 29 + ts-jest + Supertest,
  ESLint with TypeScript ruleset, Prisma + PostgreSQL 16 (ADR-001 / plan.md)
- Deferred TODOs: None
- Validation (2026-05-11): No unresolved bracket tokens; all principles declarative and
  testable; dates ISO-formatted; version line matches report.
-->

# Speckit Lab Constitution

## Core Principles

### I. Clean Code as Baseline
All production code MUST be readable, cohesive, and intentionally simple. Functions MUST
have a single responsibility, names MUST communicate intent, and duplication MUST be
eliminated or justified. Dead code, commented-out implementations, and speculative
abstractions MUST NOT be merged.
Rationale: Clean code lowers defect rates, reduces review overhead, and preserves delivery
speed as the codebase grows.

### II. TypeScript Strict Mode Mandatory
All TypeScript code MUST compile with `strict: true` enabled. Disabling strict sub-flags
for convenience is prohibited unless documented in an approved, time-bound exception.
`any` MUST NOT be introduced in business logic without a tracked justification and
remediation task.
Rationale: Strict typing catches integration and logic defects early and keeps contracts
stable across feature increments.

### III. JSDoc Documentation Required
All production code MUST include JSDoc comments for exported modules, classes, functions,
methods, and complex internal logic where behavior is non-obvious. JSDoc MUST describe
purpose, parameters, return values, thrown errors, and side effects when applicable.
Rationale: JSDoc creates a maintainable knowledge surface for onboarding, review, and safe
refactoring.

### IV. Testing Pyramid Enforcement
Testing strategy MUST follow the Testing Pyramid: many unit tests, fewer integration
tests, and minimal end-to-end tests targeted at critical flows. Business logic test
coverage MUST remain at or above 80% in each feature increment before merge.
Rationale: Pyramid-based testing maximizes feedback speed while preserving confidence in
system behavior.

### V. Incremental Simplicity and Maintainability
Each change MUST be deliverable in small, verifiable increments and MUST include
maintenance-minded decisions (clear boundaries, explicit contracts, and rollback-safe
changes). Complexity MUST be justified in the plan and tracked in implementation tasks.
Rationale: Incremental and maintainable delivery reduces operational risk and keeps future
feature cost predictable.

## Testing Principles

### TP-I. Testing Philosophy
All production code MUST be developed using Test-Driven Development (TDD). Tests MUST be
written before implementation following the RED-GREEN-REFACTOR cycle:
- **RED**: Write a failing test derived directly from the specification or acceptance
  criteria — never from existing code.
- **GREEN**: Write the minimum code required to make the test pass. No gold-plating.
- **REFACTOR**: Improve structure and readability without changing observable behavior;
  all tests MUST remain green after refactoring.

Tests MUST be generated from specifications and acceptance scenarios. A test that passes
on its first run without a prior red phase MUST be justified as a specification gap or
trivial assertion — not counted toward meaningful coverage.

Tools: **Jest 29** with `ts-jest` transformer; test files organized under `tests/unit/`,
`tests/integration/`, and `tests/contract/` as defined in the project structure.

Rationale: Specification-driven TDD produces verifiable behavior proofs and ensures
coverage is meaningful rather than incidental. It also prevents implementation bias from
infecting test design.

### TP-II. Coverage Requirements
Test distribution MUST follow the Testing Pyramid:
- **~70% unit tests**: services, utilities, validators, and business logic (Jest, no I/O
  or network calls; external dependencies MUST be mocked).
- **~20% integration tests**: API endpoints and database operations (Jest + Supertest
  against a dedicated PostgreSQL test database; Prisma migrations applied before suite).
- **~10% E2E tests**: critical user workflows only — e.g., registration → login →
  authenticated request → logout (Supertest against a running test server instance).

Coverage thresholds enforced by Jest `--coverage` (CI build MUST fail below any
threshold):
- **Line coverage**: ≥ 80%
- **Branch coverage**: ≥ 75%
- **Mutation score**: ≥ 75% (enforced via Stryker Mutator or equivalent)

Static analysis MUST pass with zero errors before merge:
- **TypeScript** `strict: true` — `tsc --noEmit` MUST report no errors.
- **ESLint** with `@typescript-eslint/recommended` ruleset — warnings treated as errors
  in CI (`--max-warnings 0`).

Rationale: Hard coverage and static analysis thresholds make quality gates objective and
machine-enforceable, preventing coverage debt and type-safety regression.

### TP-III. Test Types & Organization
Test files MUST follow this directory layout, mirroring the source tree:

```
tests/
├── unit/          # mirrors src/ structure exactly
│   ├── auth/
│   │   └── auth.service.test.ts
│   ├── users/
│   │   └── users.service.test.ts
│   └── shared/
│       └── jwt.util.test.ts
├── integration/   # grouped by feature/domain
│   ├── auth/
│   │   ├── register.test.ts
│   │   ├── login.test.ts
│   │   ├── logout.test.ts
│   │   └── password-reset.test.ts
│   └── users/
│       └── gdpr.test.ts
└── e2e/           # grouped by user journey (minimal — critical paths only)
    └── auth-flow.spec.ts
```

Rules:
- Unit test files: `tests/unit/**/*.test.ts` — one test file per source file.
- Integration test files: `tests/integration/**/*.test.ts` — grouped by feature.
- E2E test files: `tests/e2e/**/*.spec.ts` — grouped by user journey.
- Unit test file path MUST mirror its source counterpart: `src/auth/auth.service.ts` →
  `tests/unit/auth/auth.service.test.ts`.

Rationale: A predictable 1:1 mapping between source and test files makes coverage gaps
visible at a glance and eliminates ambiguity about where a test belongs.

### TP-IV. Naming Conventions
Test file naming MUST follow these patterns:

| Test type   | File name pattern                        | Example |
|-------------|------------------------------------------|---------|
| Unit        | `{ModuleName}.test.ts`                   | `auth.service.test.ts` |
| Integration | `{feature-name}.test.ts`                 | `register.test.ts` |
| E2E         | `{user-journey-name}.spec.ts`            | `auth-flow.spec.ts` |

Test suite and case naming MUST follow:
- **Describe block** (suite): `describe('ModuleName', ...)` for unit tests;
  `describe('POST /auth/register', ...)` for integration tests.
- **Test case**: `it('should <expected outcome> when <condition>', ...)` — phrased as a
  behavioural assertion, never as an imperative (e.g., NOT `it('tests login', ...)`).
- Nested `describe` blocks MAY be used to group related scenarios within a suite but
  MUST NOT exceed two levels of nesting.

Rationale: Consistent naming makes test output self-documenting and lets CI failure
messages pinpoint broken behaviour without reading test code.

### TP-V. Test Anatomy
All tests MUST follow the **Arrange-Act-Assert (AAA)** structure with a blank line
separating each phase:

```typescript
it('should return 201 and persist the user when credentials are valid', async () => {
  // Arrange
  const dto = { email: 'user@example.com', password: 'S3cure!Pass' };
  mockUserRepo.findByEmail.mockResolvedValue(null);

  // Act
  const result = await authService.register(dto);

  // Assert
  expect(result.id).toBeDefined();
  expect(mockUserRepo.create).toHaveBeenCalledOnce();
});
```

Test isolation rules:
- `beforeEach` MUST be used for per-test setup; `beforeAll` is prohibited in unit tests
  and MUST be justified with a comment if used in integration tests (e.g., one-time DB
  seed that is read-only across the suite).
- Each test MUST be independently runnable — passing when executed alone via
  `jest --testNamePattern`.
- Shared global state MUST NOT be mutated across tests. Mocks MUST be reset in
  `afterEach` (use `jest.clearAllMocks()` or equivalent via Jest config
  `clearMocks: true`).
- No test MUST depend on the execution order of other tests.

Rationale: AAA makes test intent immediately readable. Isolation guarantees that flaky
inter-test dependencies never mask real failures.

### TP-VI. Mocking & Test Data
Test doubles MUST be chosen by purpose, not convenience:

| Double | When to use | TypeScript/Jest mechanism |
|--------|-------------|---------------------------|
| **Mock** | External services: email (nodemailer), third-party APIs, payment gateways | `jest.mock()`, `jest.fn()` |
| **Stub** | Time-dependent functions: `Date.now()`, `setTimeout`, `setInterval` | `jest.useFakeTimers()`, `jest.spyOn(Date, 'now')` |
| **Fake** | Database layer in unit tests: replace Prisma client with an in-memory implementation | Hand-rolled repository fake implementing the same interface |

Test data rules:
- Complex entity graphs MUST be extracted into fixture factory functions:
  `createTestUser(overrides?)`, `createTestSession(overrides?)`, `setupMockEmailService()`.
- Fixture factories MUST accept an optional `overrides` parameter so callers can vary
  only the fields relevant to their test case.
- Fixtures MUST live in `tests/fixtures/` and MUST NOT contain business logic.

Do NOT mock:
- Code you own (services, utilities, validators) in unit tests — test it directly.
- Simple pure functions with no I/O or side effects.
- Prisma types or Zod schemas — use real instances.

Rationale: Choosing the correct double type prevents tests from being coupled to
implementation details while still isolating the subject under test from real external
dependencies.

### TP-VII. Quality Criteria
A test is only valuable if it is correct, meaningful, and trustworthy.

#### What Makes a Good Test

A test MUST satisfy ALL of the following:

1. **Tests observable behavior, not implementation details.** Assertions target return
   values, state changes visible via public API, or side effects on dependencies — never
   private methods, internal fields, or call counts that encode implementation steps.

2. **Has meaningful assertions.** Tautological assertions (`expect(x).toBe(x)`,
   `expect(true).toBe(true)`) MUST NOT be committed. Every expected value (oracle) MUST
   be derived from the specification and MUST be reviewed by a human before merge.

3. **Tests one thing.** Each `it` block MUST exercise a single behaviour or scenario.
   Multiple unrelated `expect` calls in one test case indicate it should be split.

4. **Is fast.** Unit tests MUST complete in < 1 s individually. Integration tests MUST
   complete in < 5 s individually. Suites exceeding these thresholds MUST be
   investigated and optimised.

5. **Is deterministic.** The test MUST produce the same result on every run regardless
   of execution order, system clock, network state, or filesystem contents. Non-
   determinism MUST be eliminated before the test is merged.

#### Quality Gates

The following gates MUST pass on every CI run before merge:

- **Mutation score ≥ 75%** — enforced by **Stryker Mutator**
  (`@stryker-mutator/core` + `@stryker-mutator/jest-runner`). Run via
  `npx stryker run`. A score below 75% means tests are not killing enough mutants
  and MUST be strengthened before merge.
- **No tautological assertions** — ESLint rule `jest/no-identical-title` and
  `jest/valid-expect` MUST be enabled; code review MUST catch semantic tautologies.
- **All expected values (oracles) validated by a human** — values MUST NOT be
  copy-pasted from implementation output; they MUST be independently derived from
  the specification or acceptance criteria.
- **Line coverage ≥ 80%, branch coverage ≥ 75%** — enforced by Jest `--coverage`
  thresholds (see TP-II).

#### Anti-Patterns (PROHIBITED)

The following patterns MUST NOT appear in merged test code:

| Anti-pattern | Why prohibited | Remedy |
|---|---|---|
| Testing private methods or internal state | Couples tests to implementation; breaks on any refactor | Test via the public API; trust AAA + coverage |
| Interdependent tests (order-sensitive) | Hides bugs; makes failures non-reproducible | Use `beforeEach` reset; each test self-contained |
| Brittle tests (break on unrelated refactoring) | Increases maintenance cost without finding bugs | Assert on behaviour, not structure |
| Flaky tests (intermittent failures) | Destroys CI trust | Fix root cause; use `jest.useFakeTimers()` for timing |
| Tests without assertions | Passes vacuously; provides zero value | Every test MUST have at least one `expect` |
| Copy-pasted test logic | Maintenance burden; drift between copies | Extract to fixture factories or shared helpers in `tests/helpers/` |

Rationale: Quality criteria make the test suite an asset, not a liability. A suite with
high coverage but poor mutation score, tautological assertions, or flaky tests provides
false confidence and slows delivery.

### TP-VIII. Tools & Frameworks
All tooling below is mandatory for this project unless an approved, time-bound exception
is documented per the Governance section.

#### Static Analysis

| Tool | Configuration | Purpose |
|------|---------------|---------|
| **TypeScript 5.x** | `strict: true` in `tsconfig.json` (target ES2022, moduleResolution node16) | Compile-time type safety |
| **ESLint** | `@typescript-eslint/recommended` + `eslint-plugin-jest` (`jest/valid-expect`, `jest/no-identical-title`) | Lint and test-quality rules |

#### Unit & Integration Testing

| Role | Tool | Version |
|------|------|---------|
| Test framework | **Jest** | 29.x |
| TypeScript transformer | **ts-jest** | latest compatible with Jest 29 |
| HTTP integration assertions | **Supertest** | latest |
| Assertion library | Jest built-in `expect` | (bundled with Jest 29) |
| Mocking library | Jest built-in (`jest.mock`, `jest.fn`, `jest.useFakeTimers`) | (bundled with Jest 29) |

#### E2E Testing
This project is a REST API; browser automation is not applicable. E2E tests are
critical-path HTTP flow tests executed via **Supertest** against a running Express
app instance, located in `tests/e2e/**/*.spec.ts`.

> **Optional — AI-native browser automation**: If a UI layer is added in future,
> **Stagehand** (by Browserbase) is the approved tool for AI-native browser E2E
> automation, complementing Supertest for the API layer.

#### Coverage & Mutation Quality

| Tool | Purpose | Threshold |
|------|---------|----------|
| **Jest `--coverage`** (Istanbul/V8) | Line and branch coverage reporting | Line ≥ 80%, Branch ≥ 75% |
| **Stryker Mutator** (`@stryker-mutator/core` + `@stryker-mutator/jest-runner`) | Mutation testing for TypeScript/Jest projects | Mutation score ≥ 75% |

#### Execution Commands

```bash
# Static analysis
npx tsc --noEmit                          # Type check
npx eslint . --max-warnings 0            # Lint (zero warnings)

# Tests
npm test                                  # Run all tests (unit + integration)
npx jest tests/unit                       # Unit tests only
npx jest tests/integration               # Integration tests only
npx jest tests/e2e                        # E2E tests only

# Coverage
npx jest --coverage                       # Generate coverage report

# Mutation testing
npx stryker run                           # Mutation score (Stryker)
```

#### Pre-Commit Hook
Managed via **husky** + **lint-staged** (`npm` packages). The hook MUST run in this
order on every commit:

1. `npx tsc --noEmit` — type check
2. `npx eslint . --max-warnings 0` — lint
3. `npx jest tests/unit --passWithNoTests` — unit tests only (fast gate)

Commit is blocked if any step exits non-zero.

#### CI/CD Pipeline (GitHub Actions — `main` branch)
The full pipeline MUST run on every push and pull request to `main`:

1. `npx tsc --noEmit`
2. `npx eslint . --max-warnings 0`
3. `npm test` (all tests — unit + integration + E2E)
4. `npx jest --coverage` — fail build if line < 80% or branch < 75%
5. `npx stryker run` — fail build if mutation score < 75%

All five steps MUST pass before a PR can be merged.

Rationale: Pinning specific tools and commands removes ambiguity from onboarding and CI
configuration. Mutation testing in CI closes the gap between high coverage and genuinely
effective tests.

## Engineering Standards

- TypeScript projects MUST define and enforce `strict: true` in active tsconfig files.
- Linting and formatting MUST run in CI for changed files.
- JSDoc coverage checks SHOULD run in CI; if unavailable, PR review MUST enforce this
	manually.
- Test suites MUST report coverage and MUST fail if line coverage falls below 80%,
	branch coverage falls below 75%, or mutation score falls below 75% (see TP-II, TP-VIII).
- Every feature spec and plan MUST explicitly state how these constraints are satisfied.

## Development Workflow and Quality Gates

- Constitution check MUST pass before research and before implementation.
- Plans MUST include explicit gates for clean code, strict typing, JSDoc completeness,
	testing pyramid distribution, and 80% business-logic coverage.
- Tasks MUST include work items for documentation and tests, not only implementation.
- Pull requests MUST show evidence of:
	- strict TypeScript compile success (`tsc --noEmit`),
	- ESLint passing with zero warnings,
	- required JSDoc coverage for changed code,
	- test pyramid adherence in test design,
	- line coverage >= 80%, branch coverage >= 75%, and mutation score >= 75%.

## Governance

This constitution is the highest-priority engineering policy for this repository.
Conflicting local practices, templates, or ad hoc conventions are superseded by this
document.

Amendment procedure:
- Propose amendment in writing with rationale and impacted templates.
- Review by maintainers and confirm migration actions.
- Apply required updates to dependent templates and guidance in the same change where
	practical.

Versioning policy:
- MAJOR: Backward-incompatible governance changes or principle removal/redefinition.
- MINOR: New principle/section or materially expanded mandatory guidance.
- PATCH: Clarifications, wording improvements, and non-semantic refinements.

Compliance review expectations:
- Every planning and review cycle MUST include explicit constitution compliance checks.
- Non-compliant changes MUST be blocked or covered by a documented, time-bound exception.
- Exceptions MUST include owner, expiry date, and remediation plan.

**Version**: 1.4.1 | **Ratified**: 2026-05-09 | **Last Amended**: 2026-05-11
