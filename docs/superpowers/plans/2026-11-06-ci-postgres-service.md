# CI PostgreSQL Service Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision a PostgreSQL 16 service container in the GitHub Actions CI workflow with health checks, database push, and matching development credentials so automated test suites run reliably.

**Architecture:** Add a `services: postgres` block using `postgres:16-alpine` to the `validate` job in `.github/workflows/ci.yml`, set the `DATABASE_URL` environment variable matching `docker-compose.yml` (`quiz:quiz@localhost:5432/be_quiz`), and add a schema synchronization step (`npx prisma db push`) prior to running `npm run check:all`.

**Tech Stack:** GitHub Actions, PostgreSQL 16, Prisma ORM, Vitest, npm

**Spec:** `docs/superpowers/specs/2026-11-06-ci-postgres-service-design.md`

## Global Constraints

- Never commit to git without explicit user request or consent.
- Match credentials strictly to `docker-compose.yml` and `.env.example`: `quiz:quiz@localhost:5432/be_quiz`.
- Update this plan markdown file with checkboxes (`- [x]`) immediately after finishing each step before moving on.
- Zero extra npm dependencies added to `package.json`.

## Review Focus

- Service container readiness: Ensure `pg_isready -U quiz -d be_quiz` options prevent runner race conditions before tests execute.
- Secret scanner sensitivity: Ensure no fake credentials in CI trigger `secretlint` false positives.
- Database schema initialization: Verify `npx prisma db push` executes before `npm run check:all`.
- Formatting & linting adherence: Ensure YAML indentation is 2 spaces and Prettier checks pass.
- Status synchronization in `docs/roadmap.md`.

---

### Task 1: Configure PostgreSQL Service Container & DB Push in CI Workflow

**Files:**

- Modify: `.github/workflows/ci.yml:1-35`

**Interfaces:**

- Consumes: `docker-compose.yml` credentials (`quiz:quiz@localhost:5432/be_quiz`)
- Produces: GitHub Actions CI workflow executing `npx prisma db push` and `npm run check:all` against a live `postgres:16-alpine` container

- [x] **Step 1: Update `.github/workflows/ci.yml`**
      Add the `services: postgres` definition with healthcheck, `env.DATABASE_URL`, and the `npx prisma db push` step before `npm run check:all`.

- [x] **Step 2: Validate YAML syntax of `.github/workflows/ci.yml`**
      Run: `node -e 'const yaml = require("yaml"); const fs = require("fs"); yaml.parse(fs.readFileSync(".github/workflows/ci.yml", "utf8")); console.log("YAML valid");'`
      Expected: "YAML valid"

- [x] **Step 3: Run formatting check on workflow file**
      Run: `npx prettier --check .github/workflows/ci.yml`
      Expected: All matched files use Prettier code style.

---

### Task 2: Validate Full Verification Suite & Security Checks Locally

**Files:**

- Test against: `tests/db/*`, `tests/auth/*`, `tests/admin/*`
- Verify scripts: `npm run check:all`

**Interfaces:**

- Consumes: Live local PostgreSQL instance on port 5432 (`postgresql://quiz:quiz@localhost:5432/be_quiz?schema=public`)
- Produces: 100% green verification suite output

- [x] **Step 1: Run complete verification suite (`check:all`)**
      Run: `npm run check:all`
      Expected: Typecheck passes, all Vitest test suites pass, ESLint passes, Prettier passes, audit-ci passes (0 vulnerabilities), and secretlint passes.

---

### Task 3: Roadmap Tracking & Closeout

**Files:**

- Modify: `docs/roadmap.md`

- [x] **Step 1: Update `docs/roadmap.md`**
      Mark item 12 status to link to the implementation plan `docs/superpowers/plans/2026-11-06-ci-postgres-service.md`.
