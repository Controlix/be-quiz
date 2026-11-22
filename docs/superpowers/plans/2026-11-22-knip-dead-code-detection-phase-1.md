# Knip Dead Code Detection (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Knip v6, configure `knip.json` and `package.json` audit scripts (`knip` and `knip:prod`), generate a dual-mode baseline dead-code audit report, and sync project documentation without breaking `npm run check:all`.

**Architecture:** Rely on Knip v6's auto-enabled built-in plugins (`next`, `vitest`, `prisma`, `eslint`, `postcss`, `prettier`, `tailwind`, `husky`, `lint-staged`) for framework/test/config entry resolution, while explicitly scoping `entry` to utility scripts (`scripts/**/*.ts`) and `project` to `src/**/*.{ts,tsx,css}`, `scripts/**/*.ts`, `prisma/**/*.ts`, and `tests/**/*.{ts,tsx}`. Run both default mode (`npm run knip`) and production mode (`npm run knip:prod`) to capture test-only exports alongside full-repo findings in `docs/superpowers/audit/knip-baseline-report.md`.

**Tech Stack:** Knip v6, Node.js 22 LTS, Next.js `16.4.6` (App Router), TypeScript `~6.0.3` (`moduleResolution: "bundler"`), Vitest `^5.0.5` (`environment: "node"`), Prettier, ESLint 9, `audit-ci`, `secretlint`.

**Spec:** `docs/superpowers/specs/2026-11-22-knip-dead-code-detection-design.md`

---

## Global Constraints

- **Node.js Runtime:** Node.js 22 LTS (`.github/workflows/ci.yml`).
- **Next.js / TypeScript / Vitest Versions:** Next.js `16.4.6`, TypeScript `~6.0.3` (`moduleResolution: "bundler"`, `@/*` -> `./src/*`), Vitest `^5.0.5` (`environment: "node"`).
- **Phase 1 Non-Goals:** Do NOT modify or delete application source code (`src/`) to fix detected dead exports; do NOT add `knip` to `npm run check:all` or `.github/workflows/ci.yml`; do NOT remove or bump dependencies based on Knip findings in Phase 1.
- **Zero Blanket Ignores:** Keep `ignore: []` and `ignoreDependencies: []` empty in `knip.json` during Phase 1.
- **No Git Commits Without Explicit Consent:** NEVER run `git commit` unless the user has explicitly consented.
- **Mandatory Instant Feedback & Step-by-Step Checklist:** Explain WHAT and WHY before every tool call, and mark each `- [ ]` checkbox `- [x]` immediately upon finishing that step.

## Review Focus

1. **Schema Drift (`knip@5` vs `knip@6`):** Using an outdated v5 schema URL breaks IDE validation against the installed Knip v6 package; `knip.json` must pin `https://unpkg.com/knip@6/schema.json` and keep `ignore`/`ignoreDependencies` empty (`[]`).
2. **CSS Exclusion False Positive (`tailwindcss`):** Overriding `project` in `knip.json` replaces defaults completely; omitting `.css` skips `src/app/globals.css` (`@import "tailwindcss";`) and falsely flags `tailwindcss` as unused.
3. **Premature `check:all` Gating or Missing Production Script:** Adding `knip` to `check:all` in Phase 1 would break CI before dead-code triage; omitting `knip:prod` (`knip --production`) hides dead exports/Server Actions that remain imported only by tests.
4. **Test-Only Exports Blind Spot in Baseline Report:** Default `knip` mode treats `tests/**/*.test.{ts,tsx}` as entry points, masking orphaned production exports still referenced by unit tests; `docs/superpowers/audit/knip-baseline-report.md` must explicitly document both default mode and `--production` mode results.
5. **Tooling Plugin Gap Misclassification (Secretlint):** Knip lacks a built-in Secretlint plugin for `.secretlintrc.json` (`@secretlint/secretlint-rule-preset-recommend`); the baseline report must cover all four Knip output categories and classify any Secretlint plugin gap as a non-removable tooling exception rather than dead debt.

## Testing Strategy

All configuration and audit-artifact invariants are verified deterministically under Vitest (`environment: "node"`, `vitest.config.ts`) in `tests/unit/knipConfig.test.ts` (using `fs` + `path` without DOM or subprocess flakiness), complemented by live CLI execution (`npx knip --debug`, `npm run knip`, `npm run knip:prod`) and the full `npm run check:all` pipeline:

| Source Item     | Exact `it(...)` Test Case in `tests/unit/knipConfig.test.ts`                                             |
| :-------------- | :------------------------------------------------------------------------------------------------------- |
| Review Focus #1 | `it("uses Knip v6 JSON schema and keeps ignore and ignoreDependencies empty in Phase 1")`                |
| Review Focus #2 | `it("includes CSS stylesheets, scripts, prisma, and tests in knip.json project scope")`                  |
| Review Focus #3 | `it("installs knip in devDependencies and defines knip and knip:prod scripts without gating check:all")` |
| Review Focus #4 | `it("documents both default mode and production mode sections in knip-baseline-report.md")`              |
| Review Focus #5 | `it("records all four required audit categories and classifies Secretlint plugin gaps")`                 |

---

### Task 1: Install Knip v6, Create `knip.json`, and Add `package.json` Scripts

**Files:**

- Create: `tests/unit/knipConfig.test.ts`
- Create: `knip.json`
- Modify: `package.json` (add `knip` to `devDependencies`; add `"knip"` and `"knip:prod"` to `"scripts"`)
- Modify: `package-lock.json` (updated by `npm install -D knip`)

**Interfaces:**

- Produces: `knip.json`, `package.json#devDependencies.knip`, `package.json#scripts.knip`, `package.json#scripts["knip:prod"]`, and passing config contract tests in `tests/unit/knipConfig.test.ts`.

- [x] **Step 1: Write the failing configuration contract tests**

Create `tests/unit/knipConfig.test.ts` using `vitest`, `node:fs`, and `node:path` with these exact 3 initial `it(...)` test cases:

1. `it("uses Knip v6 JSON schema and keeps ignore and ignoreDependencies empty in Phase 1")`:
   - Reads and parses `knip.json`.
   - Asserts `$schema === "https://unpkg.com/knip@6/schema.json"`.
   - Asserts `ignore` equals `[]` and `ignoreDependencies` equals `[]`.
2. `it("includes CSS stylesheets, scripts, prisma, and tests in knip.json project scope")`:
   - Asserts `knip.json` `entry` equals `["scripts/**/*.ts"]`.
   - Asserts `knip.json` `project` contains `"src/**/*.{ts,tsx,css}"`, `"scripts/**/*.ts"`, `"prisma/**/*.ts"`, and `"tests/**/*.{ts,tsx}"`.
3. `it("installs knip in devDependencies and defines knip and knip:prod scripts without gating check:all")`:
   - Reads and parses `package.json`.
   - Asserts `devDependencies.knip` is defined (string).
   - Asserts `scripts.knip === "knip"` and `scripts["knip:prod"] === "knip --production"`.
   - Asserts `scripts["check:all"]` does NOT contain `"knip"`.

- [x] **Step 2: Run the new test to verify it fails**

Run: `npx vitest run tests/unit/knipConfig.test.ts`  
Expected: FAIL because `knip.json` does not exist yet and `package.json` lacks `knip`.

- [x] **Step 3: Install `knip` as a devDependency**

Run: `npm install -D knip`  
Expected: Installs `knip` v6 cleanly with zero peer dependency resolution errors; check `npm run audit:check` exits 0.

- [x] **Step 4: Create `knip.json`**

Write `knip.json` at repository root with exact content:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["scripts/**/*.ts"],
  "project": ["src/**/*.{ts,tsx,css}", "scripts/**/*.ts", "prisma/**/*.ts", "tests/**/*.{ts,tsx}"],
  "ignore": [],
  "ignoreDependencies": []
}
```

- [x] **Step 5: Add `"knip"` and `"knip:prod"` scripts to `package.json`**

Edit `package.json#scripts` to add:

- `"knip": "knip"`
- `"knip:prod": "knip --production"`

Do NOT modify `"check:all"`.

- [x] **Step 6: Run tests to verify Task 1 passes**

Run: `npx vitest run tests/unit/knipConfig.test.ts`  
Expected: PASS (3/3 tests passing).

---

### Task 2: Verify Knip Plugin Resolution and Generate Dual-Mode Baseline Audit Report

**Files:**

- Modify: `tests/unit/knipConfig.test.ts` (append 2 report contract tests)
- Create: `docs/superpowers/audit/knip-baseline-report.md`

**Interfaces:**

- Consumes: `knip.json`, `package.json#scripts.knip`, `package.json#scripts["knip:prod"]` from Task 1.
- Produces: Verified plugin/entry resolution via `npx knip --debug` and structured baseline report `docs/superpowers/audit/knip-baseline-report.md`.

- [x] **Step 1: Add failing baseline-report contract tests to `tests/unit/knipConfig.test.ts`**

Append a `describe("Knip Baseline Audit Report", ...)` block reading `docs/superpowers/audit/knip-baseline-report.md` with these exact 2 `it(...)` cases:

1. `it("documents both default mode and production mode sections in knip-baseline-report.md")`:
   - Asserts report contains `"npm run knip"` (Default Mode section) and `"npm run knip:prod"` (Production Mode section).
2. `it("records all four required audit categories and classifies Secretlint plugin gaps")`:
   - Asserts report contains headings/sections for `"Unused files"`, `"Unused exports"`, `"Unused dependencies"`, and `"Unlisted dependencies"`.
   - Asserts report mentions `".secretlintrc.json"` / `"@secretlint/secretlint-rule-preset-recommend"` classification (whether flagged or clean) and explicitly states Phase 1 audit-only / non-remediation status.

- [x] **Step 2: Run tests to verify the new report tests fail**

Run: `npx vitest run tests/unit/knipConfig.test.ts`  
Expected: FAIL (`ENOENT` on `docs/superpowers/audit/knip-baseline-report.md`).

- [x] **Step 3: Inspect plugin & entry resolution with `npx knip --debug`**

Run: `npx knip --debug`  
Verify:

- Knip v6 executes cleanly under Node 22 and TypeScript `~6.0.3` (`tsconfig.json`).
- Enabled plugins include `Next.js`, `Vitest`, `Prisma`, `ESLint`, `PostCSS`, `Prettier`, `Tailwind`, `Husky`, and `lint-staged`.
- Entry files include `src/app/auth/join/route.ts`, `src/app/auth/logout/route.ts`, `src/proxy.ts`, `src/instrumentation.ts`, `prisma/seed.ts`, and `tests/**/*.test.{ts,tsx}`.
- Project files include `src/app/globals.css` with no configuration hints warning about excluded `.css`.

- [x] **Step 4: Execute both audit modes (`npm run knip` and `npm run knip:prod`)**

Run: `npm run knip`  
Run: `npm run knip:prod`  
_(Note: Non-zero exit codes are expected when Knip finds dead exports/files/dependencies; record the full categorized findings from both runs without altering `src/`.)_

- [x] **Step 5: Author `docs/superpowers/audit/knip-baseline-report.md`**

Create `docs/superpowers/audit/knip-baseline-report.md` documenting:

1. **Audit Context & Environment:** Date (`2026-11-22`), Knip version, Node 22, TypeScript `~6.0.3`, active plugins confirmed via `npx knip --debug`, and explicit note that Phase 1 is audit-only (no source files edited).
2. **Default Mode Findings (`npm run knip`):**
   - `Unused files`
   - `Unused exports` / exported types
   - `Unused dependencies` / `devDependencies` (explicitly classifying any `.secretlintrc.json` / `@secretlint/secretlint-rule-preset-recommend` plugin gap as a non-removable tooling exception)
   - `Unlisted dependencies`
3. **Production Mode Findings (`npm run knip:prod`):**
   - Same 4 categories for production mode, highlighting any dead exports or Server Actions (e.g., `resetRegisteredAction`) exposed once `tests/` are excluded.
4. **Phase 2 Triage Summary:** Prioritized remediation checklist for Phase 2 (confirmed dead code vs. intentional/tooling exceptions).

- [x] **Step 6: Run tests to verify Task 2 passes**

Run: `npx vitest run tests/unit/knipConfig.test.ts`  
Expected: PASS (5/5 tests passing).

---

### Task 3: Sync Documentation & Verify Full Quality Pipeline

**Files:**

- Modify: `docs/roadmap.md` (Part 2, Section E, Item 2 `#E.2`)
- Modify: `docs/architecture/overview.md` (Section 6 "Verification Commands")

**Interfaces:**

- Consumes: `docs/superpowers/audit/knip-baseline-report.md` and `package.json` scripts from Tasks 1–2.
- Produces: Synchronized project documentation and 100% passing `npm run check:all`.

- [x] **Step 1: Update `docs/roadmap.md` (`#E.2`)**

Edit Part 2, Section E, Item 2 (`Automated Dead Code & Unused Export Detection (Knip Integration)`) in `docs/roadmap.md` to record:

- Phase 1 complete (`knip.json`, `npm run knip`, `npm run knip:prod`, and baseline report `docs/superpowers/audit/knip-baseline-report.md`).
- Phase 2 remaining (triage/remediate confirmed dead exports/dependencies and integrate `knip` into `npm run check:all`).

- [x] **Step 2: Update `docs/architecture/overview.md` (Section 6)**

Add `npm run knip` and `npm run knip:prod` to the verification commands list in Section 6 ("Developer Tooling & Security Standards") of `docs/architecture/overview.md`, noting that Phase 1 runs standalone for dead-code auditing prior to Phase 2 `check:all` integration.

- [x] **Step 3: Format and run complete quality & security suite**

Run: `npm run format:write` (only if `format:check` flags any edited/created file)  
Run: `npm run check:all`  
Expected: `typecheck`, `test`, `lint`, `format:check`, `audit:check`, and `scan:secrets` all PASS with exit code 0.

- [x] **Step 4: Present summary and ask user before any Git commit**

Report verified results (`knip.json`, `knip` / `knip:prod` summary, `docs/superpowers/audit/knip-baseline-report.md`, and `npm run check:all` pass) and ask for explicit user consent before running any `git commit`.
