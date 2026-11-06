# Design Specification: GitHub Actions CI PostgreSQL Service Container

**Date:** 2026-11-06  
**Status:** Ready for Review  
**Related ADR:** [ADR 0005: GitHub Actions PostgreSQL Service Container](../../adr/0005-ci-postgresql-service-container.md)  
**Roadmap Item:** Item 12 (`docs/roadmap.md`)

---

## 1. Intent & Purpose

Resolve recurring test suite failures in GitHub Actions (`.github/workflows/ci.yml`) by providing an ephemeral PostgreSQL 16 service container, ensuring `npm run check:all` executes tests against a real, initialized database with parity to local development.

## 2. Goals, Non-Goals, & Anti-Goals

### Goals

- Enable the CI `validate` job to run all integration tests (`tests/db/*`, `tests/auth/*`, `tests/admin/*`) successfully.
- Mirror local dev environment settings from `docker-compose.yml` (`user: quiz`, `password: quiz`, `db: be_quiz`, `port: 5432`).
- Include robust healthchecks in the service definition (`pg_isready -U quiz -d be_quiz`) so the runner waits until PostgreSQL is ready.
- Initialize the database schema with `npx prisma db push` before running `npm run check:all`.
- Update `docs/roadmap.md` to link to this design spec and track its active state.

### Non-Goals

- Modifying test files, application runtime code, or Vitest configs.
- Adding third-party test container dependencies (e.g. `@testcontainers/postgresql`).
- Pre-seeding mock data in CI (tests manage their own test fixtures and clean up state).

### Anti-Goals

- Do not introduce mock databases or SQLite substitutions that diverge from PostgreSQL behavior.
- Do not add CI-specific bypasses or skip flags to Vitest commands.

## 3. Constraints & Invariants

- **Credential & Schema Consistency:** Must match `.env.example` and `docker-compose.yml` credentials (`quiz:quiz@localhost:5432/be_quiz`) while targeting `schema=test` to match the test runner environment in `vitest.config.ts`:
  `DATABASE_URL="postgresql://quiz:quiz@localhost:5432/be_quiz?schema=test"`
- **Service Container Configuration:** Use `postgres:16-alpine` to match `docker-compose.yml`.
- **Healthcheck Requirement:** The service container must define options with `pg_isready` interval/timeout/retries to prevent race conditions during runner start.
- **Seeding Requirement:** After `npx prisma db push`, `npx prisma db seed` must execute to provide default singleton settings required by integration tests.

## 4. Approaches Considered

1. **Option 1: Testcontainers (`@testcontainers/postgresql`)**  
   Dynamic per-suite container management in Node. Rejected due to startup latency (5-15s), Docker socket requirements in CI, and extra dependency footprint.
2. **Option 2: Native GitHub Actions Service Container (`services: postgres`) (Selected)**  
   Lightweight, native runner orchestration matching local Docker setup, zero npm dependencies, and fast startup.

## 5. Specification Details

### 5.1 Workflow File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    name: Code Quality & Security Verification
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: quiz
          POSTGRES_PASSWORD: quiz
          POSTGRES_DB: be_quiz
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U quiz -d be_quiz"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: "postgresql://quiz:quiz@localhost:5432/be_quiz?schema=test"

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Push Prisma schema to test database
        run: npx prisma db push

      - name: Seed test database
        run: npx prisma db seed

      - name: Run complete verification suite
        run: npm run check:all
```

## 6. What's Left for the Builder

- Update `.github/workflows/ci.yml` with the specified configuration.
- Update `docs/roadmap.md` to reflect status and link to the design spec.
- Run `npm run check:all` locally to verify full suite passes against a live database.
