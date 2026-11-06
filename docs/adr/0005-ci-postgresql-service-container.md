# ADR 0005: GitHub Actions PostgreSQL Service Container for CI Verification

**Date:** 2026-11-06  
**Status:** Accepted  
**Deciders:** Team

---

## Context & Problem Statement

Every Pull Request and commit push currently fails the `Code Quality & Security Verification` workflow in `.github/workflows/ci.yml`. The job crashes during `npm run check:all` -> `vitest run` with:

```text
PrismaClientInitializationError: Can't reach database server at `localhost:5432`
```

Vitest test suites in `tests/db/*`, `tests/auth/*`, and `tests/admin/*` perform real database operations via Prisma against PostgreSQL on `localhost:5432`. However, GitHub Actions runs the verification job on bare `ubuntu-latest` without a running PostgreSQL instance or schema initialization.

We need a deterministic, low-overhead way to provide a real PostgreSQL instance during CI runs so all automated test suites pass reliably.

## Decision Drivers

- **Zero Test Code Modification & Local Dev Parity:** Local development uses `docker compose up -d` targeting `localhost:5432` with user `quiz` and database `be_quiz`. CI should match this exact configuration with zero custom harness code.
- **Fast Execution & Minimal CI Overhead:** Test runs must boot rapidly without introducing heavy per-test startup penalties.
- **Dependency & Attack Surface Minimization:** Avoid introducing new runtime or test dependencies that add CVE surface or complicate package audits.
- **Zero In-Memory Mocking of Prisma/Database:** Retain real database queries against PostgreSQL to catch actual relational constraints, migrations, and cascade behavior.

## Considered Options

1. **Option 1: Testcontainers (`@testcontainers/postgresql`)**
   - _Pros:_
     - Completely self-contained within test runner code; manages container lifecycle dynamically.
     - Dynamic ephemeral ports avoid collisions in environments running multiple test runners concurrently.
   - _Cons:_
     - Adds `@testcontainers/postgresql` and Docker engine dependencies to the Node project.
     - Significant startup delay (5–15+ seconds per container boot and schema push), slowing down local Vitest watch mode.
     - Requires Docker socket access inside the test execution runtime, which can fail in sandboxed or containerized CI environments.

2. **Option 2: Prisma Mocking / In-Memory Mocking (e.g. `prismock` or SQLite fallback)**
   - _Pros:_
     - Does not require Docker or PostgreSQL service.
   - _Cons:_
     - SQLite does not support native PostgreSQL features (enums, specific schema constraints, distinct relational nuances).
     - Mocking Prisma hides real database regressions, query errors, and migration incompatibilities. Violates the core testing principle of validating real domain persistence.

3. **Option 3: GitHub Actions Native Service Container (`services: postgres`) (Selected)**
   - _Pros:_
     - Native GitHub Actions feature supported out of the box with `postgres:16-alpine`.
     - Zero extra npm dependencies or modifications to test suites and Vitest configs.
     - Starts in parallel with job runner setup; container is immediately healthy when the test step executes.
     - 100% environment parity with local `docker-compose.yml` (`quiz:quiz@localhost:5432/be_quiz`).
   - _Cons:_
     - Specific to GitHub Actions CI; local developers continue using `docker compose up -d`.

## Decision Outcome

We chose **Option 3 (GitHub Actions Native Service Container)** because it provides exact parity with local `docker-compose.yml`, introduces zero extra npm dependencies, maintains fast execution times, and requires zero changes to application or test code.

## Consequences

- **Positive:**
  - Automated PR checks, Dependabot runs, and main branch pushes execute against a real, healthy PostgreSQL 16 instance.
  - Integration tests in `tests/db/*`, `tests/auth/*`, and `tests/admin/*` run deterministically in CI without errors.
  - Zero performance degradation in local test runs.
- **Negative / Trade-offs:**
  - The workflow requires configuring a container service healthcheck (`pg_isready -U quiz -d be_quiz`) to ensure the database accepts connections before running migrations.
- **Invariants Introduced:**
  - CI environment credentials must stay synchronized with `.env.example` and `docker-compose.yml` (`quiz:quiz@localhost:5432/be_quiz`).
  - In CI, `DATABASE_URL` targets `schema=test` to match the test runner environment in `vitest.config.ts`.
  - The test schema must be initialized via `npx prisma db push` and seeded via `npx prisma db seed` before running tests.

## Validation & Confirmation

- The `.github/workflows/ci.yml` workflow file will be updated with the `services: postgres` block, `DATABASE_URL="postgresql://quiz:quiz@localhost:5432/be_quiz?schema=test"`, `npx prisma db push`, and `npx prisma db seed`.
- Verified by checking workflow syntax and running `DATABASE_URL="postgresql://quiz:quiz@localhost:5432/be_quiz?schema=test" npm run check:all` locally.
