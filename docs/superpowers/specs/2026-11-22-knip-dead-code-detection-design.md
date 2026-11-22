# Design Document: Automated Dead Code & Unused Export Detection (Knip Integration — Phase 1)

**Date:** 2026-11-22  
**Status:** Reviewed / Ready for Implementation Planning  
**Milestone:** v1.1 Polish & CI/CD Infrastructure (Roadmap Rank 2 / Item E.2)  
**Related Specs/Issues:** `docs/roadmap.md` (#E.2)

---

## 1. Intent & The Why

Standard TypeScript compiler checks (`tsc --noEmit` with `noUnusedLocals`) and ESLint only verify unexported, file-local symbols. Once a function, type, or component is `export`ed, standard tools treat it as a public API contract and skip dead-export analysis.

In Next.js App Router applications, Server Actions marked with `"use server"` are compiled into public HTTP RPC endpoints. When an action or component is orphaned (e.g. legacy `resetRegisteredAction` in `src/actions/registrationActions.ts`), it remains reachable over the wire, accumulates technical debt, increases bundle size, and introduces potential unauthenticated attack surfaces.

This initiative introduces **[Knip](https://knip.dev/)** into the repository to perform whole-project static analysis. To ensure stability and avoid blocking ongoing development in a single massive change, this work is explicitly split into two phases:

- **Phase 1 (This Design):** Install Knip, configure project entry points and framework plugins in `knip.json`, add an npm script (`npm run knip`), and generate an initial baseline audit report without gating or failing `npm run check:all`.
- **Phase 2 (Subsequent Task):** Systematically remediate confirmed dead exports, prune obsolete dependencies, and integrate `knip` into `npm run check:all` and CI as an automated blocking quality gate.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals

1. Add `knip` to `devDependencies` in `package.json`.
2. Configure `knip.json` (Knip v6) leveraging Knip's built-in auto-enabled plugins while explicitly covering project scripts, stylesheets, and tests:
   - **Auto-Enabled Plugins (verified via `npx knip --debug`):**
     - **Next.js (`next`):** App Router pages/layouts/templates/errors/metadata, all route handlers (`src/app/**/route.ts`, including `src/app/api/**/route.ts` and `src/app/auth/{join,logout}/route.ts`), `src/instrumentation.ts`, `src/proxy.ts`, and `next.config.ts`.
     - **Database & Prisma (`prisma`):** `prisma/schema.prisma` and `package.json#prisma.seed` (`tsx prisma/seed.ts`).
     - **Test Suite (`vitest`):** `vitest.config.ts` and `tests/**/*.{test,test-d,spec,spec-d}.?(c|m)[jt]s?(x)`.
     - **Tooling & Styling (`eslint`, `postcss`, `prettier`, `tailwind`, `husky`, `lint-staged`):** `eslint.config.mjs`, `postcss.config.mjs`, `.prettierrc.json`, `.lintstagedrc.json`, `.husky/*`, and CSS imports (`src/app/globals.css`).
   - **Explicitly Mapped Utility Scripts & Project Scope:** `scripts/**/*.ts` in `entry`, and `src/**/*.{ts,tsx,css}`, `scripts/**/*.ts`, `prisma/**/*.ts`, `tests/**/*.{ts,tsx}` in `project`.
3. Provide executable scripts in `package.json`: `"knip": "knip"` (default full-repo mode) and `"knip:prod": "knip --production"` (production-only mode to expose exports referenced exclusively by tests).
4. Run both audit modes and record the findings into an authoritative report file: `docs/superpowers/audit/knip-baseline-report.md`, and sync `docs/roadmap.md` and `docs/architecture/overview.md` (Section 6 verification commands).
5. Maintain 100% passing state for all existing quality checks (`npm run check:all`).

### Non-Goals (Deferred to Phase 2)

- Modifying or deleting application source code to fix dead exports detected during the initial scan.
- Adding `npm run knip` to `npm run check:all` or CI workflows before remediation.
- Bumping or removing unused npm packages until triage is completed.

### Anti-Goals

- Adding blanket file or directory ignore rules in `knip.json` that mask real dead code in core application folders (`src/actions`, `src/components`, `src/services`, `src/lib`).
- Introducing breaking changes to existing build, dev, test, or deployment pipelines.

---

## 3. Constraints & Technical Environment

- **Node.js Runtime:** Node.js 22 LTS (as pinned in `.github/workflows/ci.yml`).
- **Next.js Version:** `16.4.6` (App Router).
- **TypeScript:** `~6.0.3` with `moduleResolution: "bundler"` and path alias `@/*` pointing to `./src/*`.
- **Vitest:** `^5.0.5` utilizing standard Node.js test runner environment.
- **Strict Peer Dependencies:** Ensure `knip` installation does not introduce unresolved peer dependency conflicts with existing packages.

---

## 4. Approaches Considered & Decision

### Approach 1: Strict Single-Phase Gate

- Immediately install Knip, clean up all detected dead code across the entire codebase in one batch, and add Knip as a blocking check to `check:all`.
- _Why not chosen:_ High blast radius. Coupling tooling introduction with broad multi-file refactoring risks regressions across unrelated features.

### Approach 2: Phased Implementation (Chosen by Human Partner)

- **Phase 1:** Install Knip, configure `knip.json`, add script, run audit, and document the baseline report.
- **Phase 2:** Triage and delete confirmed dead code, then add `knip` to `check:all` to block future regressions.
- _Trade-off:_ Delays automated gate enforcement to Phase 2, but provides an empirical inventory of dead code first so remediation can be reviewed safely.

### Approach 3: Scope-Restricted Knip (Server Actions Only)

- Restrict Knip to scan only `src/actions/`.
- _Why not chosen:_ Leaves blind spots for orphaned components, unused utilities, and dead dependencies.

---

## 5. Specification: Phase 1 Implementation Details

### 5.1 Package Installation

- Install `knip` as a devDependency using `npm install -D knip`.

### 5.2 Configuration (`knip.json`)

The configuration must accurately capture the repository's architecture without false positives. Because custom `entry` and `project` arrays in `knip.json` **replace** Knip's root defaults (rather than merging), `project` must explicitly include `.css` (so `src/app/globals.css`'s `@import "tailwindcss";` is compiled) and `tests/**` (to detect orphaned test helpers in default mode), while leaving framework, test, and tooling entry points to Knip's auto-enabled plugins:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["scripts/**/*.ts"],
  "project": ["src/**/*.{ts,tsx,css}", "scripts/**/*.ts", "prisma/**/*.ts", "tests/**/*.{ts,tsx}"],
  "ignore": [],
  "ignoreDependencies": []
}
```

_Notes for Builder:_

- Verify with `npx knip --debug` that Knip's built-in plugins (`next`, `vitest`, `prisma`, `eslint`, `postcss`, `prettier`, `tailwind`, `husky`, `lint-staged`) resolve all App Router pages, non-`/api` route handlers (`src/app/auth/{join,logout}/route.ts`), `src/proxy.ts`, `src/instrumentation.ts`, `prisma/seed.ts`, and `tests/**/*.test.{ts,tsx}` without manual duplication.
- **Expected Tooling Gaps:** Knip has no built-in Secretlint plugin to parse `.secretlintrc.json` (`@secretlint/secretlint-rule-preset-recommend`). Keep `ignoreDependencies` empty (`[]`) during Phase 1 so the baseline report captures raw findings, and clearly classify any such tooling config gaps in the report as non-removable exceptions for Phase 2 triage.

### 5.3 Package Scripts

In `package.json`:

```json
"scripts": {
  ...
  "knip": "knip",
  "knip:prod": "knip --production",
  ...
}
```

_Note:_ Do NOT alter `"check:all"` in Phase 1.

### 5.4 Baseline Audit Report (`docs/superpowers/audit/knip-baseline-report.md`)

Execute **both** `npm run knip` (default mode, including `tests/`, `scripts/`, and `devDependencies`) and `npm run knip:prod` (`knip --production`, isolating production files and `dependencies` so dead exports/Server Actions still imported only by unit tests are not masked). Capture the structured output for both modes:

1. **Unused files:** Files in the repository never imported or reached by entry points.
2. **Unused exports / exported types:** Functions, types, or constants exported but never referenced elsewhere (highlighting test-only exports surfaced by `knip:prod`).
3. **Unused dependencies / devDependencies:** Packages in `package.json` not imported in the project (distinguishing real candidates from Knip plugin gaps such as `.secretlintrc.json`).
4. **Unlisted dependencies:** Any imported modules not explicitly listed in `package.json`.

---

## 6. What's Left to the Builder

1. Verifying Knip v6 CLI compatibility with Node 22 and TypeScript `~6.0.3` (`tsconfig.json` with `moduleResolution: "bundler"`).
2. Verifying auto-enabled plugin resolution via `npx knip --debug` (`next`, `vitest`, `prisma`, `postcss`, `eslint`, `prettier`, `tailwind`, `husky`, `lint-staged`) and confirming `src/app/auth/**/route.ts` and `src/app/globals.css` are resolved cleanly.
3. Running both `npm run knip` and `npm run knip:prod` and formatting the empirical baseline report in `docs/superpowers/audit/knip-baseline-report.md`.
4. Updating `docs/roadmap.md` (`#E.2` Phase 1 status / Phase 2 tracking) and `docs/architecture/overview.md` (Section 6 verification commands) to reflect the new scripts.
5. Ensuring `npm run check:all` passes without error.
