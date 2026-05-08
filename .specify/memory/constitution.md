<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles:
	- Template Principle 1 -> I. Clean Code as Baseline
	- Template Principle 2 -> II. TypeScript Strict Mode Mandatory
	- Template Principle 3 -> III. JSDoc Documentation Required
	- Template Principle 4 -> IV. Testing Pyramid Enforcement
	- Template Principle 5 -> V. Incremental Simplicity and Maintainability
- Added sections:
	- Engineering Standards
	- Development Workflow and Quality Gates
- Removed sections:
	- None
- Templates requiring updates:
	- ✅ updated: .specify/templates/plan-template.md
	- ✅ updated: .specify/templates/spec-template.md
	- ✅ updated: .specify/templates/tasks-template.md
	- ⚠ pending: .specify/templates/commands/*.md (directory not present in repository)
	- ✅ reviewed: .specify/extensions/git/README.md (no constitution-specific references)
- Deferred TODOs:
	- None
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

## Engineering Standards

- TypeScript projects MUST define and enforce `strict: true` in active tsconfig files.
- Linting and formatting MUST run in CI for changed files.
- JSDoc coverage checks SHOULD run in CI; if unavailable, PR review MUST enforce this
	manually.
- Test suites MUST report business-logic coverage and fail below 80%.
- Every feature spec and plan MUST explicitly state how these constraints are satisfied.

## Development Workflow and Quality Gates

- Constitution check MUST pass before research and before implementation.
- Plans MUST include explicit gates for clean code, strict typing, JSDoc completeness,
	testing pyramid distribution, and 80% business-logic coverage.
- Tasks MUST include work items for documentation and tests, not only implementation.
- Pull requests MUST show evidence of:
	- strict TypeScript compile success,
	- required JSDoc coverage for changed code,
	- test pyramid adherence in test design,
	- and business-logic coverage >= 80%.

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

**Version**: 1.0.0 | **Ratified**: 2026-05-09 | **Last Amended**: 2026-05-09
