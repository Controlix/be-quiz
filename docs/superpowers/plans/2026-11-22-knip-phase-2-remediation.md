# Knip Dead Code Remediation & Blocking Quality Gate (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every dead export, orphaned Server Action, duplicate alias, test-only service export, and unused dependency reported by `npm run knip` and `npm run knip:prod`, then gate `npm run check:all` on both Knip checks passing.

**Architecture:** Remove confirmed dead code (`resetRegisteredAction`, `src/lib/mockData.ts`, `clsx`, `tailwind-merge`), standardize canonical registration functions (`registerTeam`, `unregisterTeam`), un-export single-file types, relocate `getRsvpLineup` / `RsvpWithDetails` to `tests/helpers/rsvpLineup.ts`, enable `ignoreExportsUsedInFile: true` for unit-tested internal helpers, annotate pre-built `#1 Edit Quiz Details` / `#5` helpers with `/** @internal */`, replace `eslint-config-next` with `@next/eslint-plugin-next`, and enforce both `knip` and `knip:prod` inside `npm run check:all`.

**Tech Stack:** Knip `^6.47.0`, Node.js 22 LTS, Next.js `16.4.6` (App Router), TypeScript `~6.0.3` (`moduleResolution: "bundler"`, `@/*` -> `./src/*`), Vitest `^5.0.5` (`environment: "node"`), ESLint 9, Prettier, `audit-ci`, `secretlint`.

**Spec:** `docs/superpowers/specs/2026-11-22-knip-phase-2-remediation-design.md`

---

## Global Constraints

- **Node.js & Toolchain Versions:** Node.js 22 LTS (`.github/workflows/ci.yml`), Next.js `16.4.6`, TypeScript `~6.0.3`, Vitest `^5.0.5` (`environment: "node"`).
- **Zero Allowlist Security Policy:** `audit-ci.json` `allowlist` MUST remain `[]`; verify `npm run audit:check` exits `0` after every dependency change.
- **No Unintended ESLint Rule Drift:** Do NOT switch `eslint.config.mjs` to `eslint-config-next/core-web-vitals`; keep existing `@next/eslint-plugin-next` flat-config rules intact.
- **Preserve Planned Feature & Test Coverage:** Do NOT delete `updateQuizDetails` / `UpdateQuizDetailsInput`, `formatEuropeanDate` / `formatEuropeanTime`, or `getRsvpLineup` tests; do NOT add blanket `ignore` globs in `knip.json` that mask `src/`.
- **Single-Source / `"use server"` Export Discipline:** Never export non-action helpers from `"use server"` files (`src/actions/*.ts`), since `ignoreExportsUsedInFile: true` applies globally and `"use server"` exports compile to public RPC endpoints.
- **No Git Commits Without Explicit Consent:** NEVER run `git commit` or `git tag` unless the user has explicitly consented.
- **Mandatory Instant Feedback & Step-by-Step Checklist:** Explain WHAT and WHY before every tool call, and mark each `- [ ]` checkbox `- [x]` immediately upon finishing that step.

## Review Focus

1. **Orphaned Server Action & Legacy Mock Removal (`resetRegisteredAction`, `src/lib/mockData.ts`):** Leaving `resetRegisteredAction` in `src/actions/registrationActions.ts` exposes an unauthenticated RPC endpoint, and leaving `src/lib/mockData.ts` or exporting `QuizCardQuiz` in `src/components/QuizCard.tsx` triggers unused-export errors in `npm run knip`.
2. **Canonical Registration Service Names Without Duplicate Aliases:** Renaming `setTeamRegistered` -> `registerTeam` and `adminResetRegistration` -> `unregisterTeam` in `src/services/registrationService.ts` while deleting bottom aliases must keep `registrationActions.ts`, `adminActions.ts`, and `domain-events-emission.test.ts` compiling and passing without duplicate-export warnings.
3. **Production Isolation of Test-Only Helpers (`getRsvpLineup`) & `@internal` Preserved Exports:** Relocating `getRsvpLineup` / `RsvpWithDetails` to `tests/helpers/rsvpLineup.ts` and tagging `updateQuizDetails`, `UpdateQuizDetailsInput`, `formatEuropeanDate`, and `formatEuropeanTime` with `/** @internal */` must pass `npm run knip:prod` while keeping all 6 affected test suites and `npm run knip` coverage enforcement green.
4. **Tooling Dependency Swap (`eslint-config-next` -> `@next/eslint-plugin-next`) & Secretlint Hygiene:** Uninstalling `clsx`, `tailwind-merge`, `eslint-config-next`, and (if verified unnecessary) `@secretlint/quick-start`, installing `@next/eslint-plugin-next@^16.4.6`, and removing `"main": "index.js"` must keep `npm run lint`, `npm run scan:secrets`, and `npm run audit:check` (`allowlist: []`) passing cleanly.
5. **Dual Knip Quality Gate (`check:all`) & Config Contract:** `knip.json` must enable `ignoreExportsUsedInFile: true`, keep `ignore: []`, whitelist only verified plugin-gap tooling dependencies (`@secretlint/secretlint-rule-preset-recommend`), and `package.json#scripts.check:all` must execute both `npm run knip` and `npm run knip:prod` with exit code `0`.

## Testing Strategy

Each `Review Focus` item is verified by the actual static-analysis tool, behavioral test suite, or configuration-gate contract that enforces it — avoiding redundant file-scraping string assertions:

| Source Item     | Authoritative Verification                                                                                                                               |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review Focus #1 | `npm run knip` + `npm run typecheck` + `tests/components/QuizCardRating.test.tsx`                                                                        |
| Review Focus #2 | `npm run knip` + `npm run knip:prod` + `npm run typecheck` + `tests/services/domain-events-emission.test.ts`                                             |
| Review Focus #3 | `npm run knip:prod` + `npm run knip` + `npm run typecheck` + all 6 `rsvpLineup` integration suites + `tests/lib/formatters.test.ts`                      |
| Review Focus #4 | `npm run lint` + `npm run scan:secrets` + `npm run audit:check` (`allowlist: []`) + `npm run knip`                                                       |
| Review Focus #5 | `tests/unit/knipConfig.test.ts` (`ignore: []`, `ignoreExportsUsedInFile: true`, Secretlint `ignoreDependencies`, `check:all` gate) + `npm run check:all` |

---

### Task 1: Remove Dead Exports, Inline `QuizCardQuiz`, Un-Export Single-File Types & Standardize Registration Service

**Files:**

- Modify: `src/services/registrationService.ts:4-39`
- Modify: `src/actions/registrationActions.ts:1-35`
- Modify: `src/actions/adminActions.ts:11,37-52`
- Modify: `src/components/QuizCard.tsx:1-10`
- Delete: `src/lib/mockData.ts`
- Modify: `src/components/LoginPinClient.tsx:8`
- Modify: `src/components/TeamLineup.tsx:18`
- Modify: `src/features/calendar/shared/googleCalendarClient.ts:4`
- Modify: `src/features/calendar/shared/mappingRepository.ts:3`

**Interfaces:**

- Produces:
  - `src/services/registrationService.ts`: `export async function registerTeam(teamId: string, memberId: string): Promise<void>` and `export async function unregisterTeam(teamId: string): Promise<void>` (no duplicate `export const` aliases).
  - `src/actions/registrationActions.ts`: exports only `setRegisteredAction` and `toggleFeePaidAction` (no `resetRegisteredAction`).
  - `src/actions/adminActions.ts`: `adminResetRegistrationAction(teamId: string)` calls `unregisterTeam(teamId)`.
  - `src/components/QuizCard.tsx`: local unexported `interface QuizCardQuiz` replacing `@/lib/mockData`.
  - Unexported single-file interfaces: `LoginMember`, `DeclinedMember`, `UpdateEventResult`, `CalendarEventMappingRecord`.

- [x] **Step 1: Standardize `registerTeam` and `unregisterTeam` across service and Server Actions**

1. In `src/services/registrationService.ts`:
   - Rename `export async function setTeamRegistered` -> `export async function registerTeam`.
   - Rename `export async function adminResetRegistration` -> `export async function unregisterTeam`.
   - Delete lines 38–39 (`export const registerTeam = ...`, `export const unregisterTeam = ...`).
2. In `src/actions/registrationActions.ts`:
   - Update import to `import { registerTeam } from "@/services/registrationService";`.
   - Update `setRegisteredAction` to call `await registerTeam(teamId, memberId);`.
   - Delete `resetRegisteredAction` completely.
3. In `src/actions/adminActions.ts`:
   - Update import to `import { unregisterTeam } from "@/services/registrationService";`.
   - Update `adminResetRegistrationAction` (keeping its exported name unchanged) to call `await unregisterTeam(teamId);`.

- [x] **Step 2: Inline `QuizCardQuiz` in `src/components/QuizCard.tsx` and delete `src/lib/mockData.ts`**

In `src/components/QuizCard.tsx`:

- Remove `import { MockQuiz } from "@/lib/mockData";`.
- Define unexported `interface QuizCardQuiz` with the exact fields currently in `MockQuiz` (`id`, `title`, `startsAt`, `location`, `entryFee?`, `status`, `team: { name, maxTeamSize, registeredAt, paidAt, paidByName?, rsvps: Array<{ id, memberName, status }> }`) and type `QuizCardProps.quiz: QuizCardQuiz`.
- Delete `src/lib/mockData.ts`.

- [x] **Step 3: Un-export single-file interfaces**

Remove the `export` keyword from:

- `interface LoginMember` in `src/components/LoginPinClient.tsx:8`
- `interface DeclinedMember` in `src/components/TeamLineup.tsx:18`
- `interface UpdateEventResult` in `src/features/calendar/shared/googleCalendarClient.ts:4`
- `interface CalendarEventMappingRecord` in `src/features/calendar/shared/mappingRepository.ts:3`

- [x] **Step 4: Verify existing behavioral tests and TypeScript compilation pass**

Run: `npx vitest run tests/components/QuizCardRating.test.tsx tests/services/domain-events-emission.test.ts && npm run typecheck`  
Expected: PASS (all tests green, 0 TypeScript errors).

---

### Task 2: Relocate `getRsvpLineup` to `tests/helpers/rsvpLineup.ts` and Add `/** @internal */` Tags

**Files:**

- Create: `tests/helpers/rsvpLineup.ts`
- Modify: `src/services/rsvpService.ts:1-38`
- Modify: `src/services/quizService.ts:169-186`
- Modify: `src/lib/formatters.ts:4-14`
- Modify: `tests/services/guestRsvpService.test.ts`
- Modify: `tests/services/rsvpConcurrency.test.ts`
- Modify: `tests/services/rsvpAdminOverride.test.ts`
- Modify: `tests/services/rosterReorder.test.ts`
- Modify: `tests/e2e/acceptance.test.ts`
- Modify: `tests/admin/adminActions.test.ts`

**Interfaces:**

- Produces:
  - `tests/helpers/rsvpLineup.ts`: `export type RsvpWithDetails = Rsvp & { member: Member | null; invitedBy?: Member | null };` and `export async function getRsvpLineup(teamId: string): Promise<{ active: RsvpWithDetails[]; reserves: RsvpWithDetails[] }>`.
  - `src/services/rsvpService.ts`: removes `RsvpWithDetails`, `RsvpWithMember`, and `getRsvpLineup`.
  - `src/services/quizService.ts`: `/** @internal */` JSDoc directly above `export interface UpdateQuizDetailsInput` and `export async function updateQuizDetails`.
  - `src/lib/formatters.ts`: `/** @internal */` JSDoc directly above `export function formatEuropeanDate` and `export function formatEuropeanTime`.

- [x] **Step 1: Create `tests/helpers/rsvpLineup.ts` and clean `src/services/rsvpService.ts`**

1. Create `tests/helpers/rsvpLineup.ts` importing `{ prisma } from "@/lib/db"` and `{ Rsvp, Member } from "@prisma/client"`, exporting `RsvpWithDetails` and `getRsvpLineup(teamId: string)`.
2. Remove lines 5–37 (`RsvpWithDetails`, `RsvpWithMember`, `getRsvpLineup`) from `src/services/rsvpService.ts` (keeping `Rsvp, Member` import since `addGuestRsvp` uses `Rsvp & { invitedBy: Member | null }`).

- [x] **Step 2: Update imports in all 6 Vitest test files**

Update `getRsvpLineup` import source to `../helpers/rsvpLineup` (matching the directory depth of `tests/services/*`, `tests/e2e/*`, and `tests/admin/*`):

- `tests/services/guestRsvpService.test.ts`
- `tests/services/rsvpConcurrency.test.ts`
- `tests/services/rsvpAdminOverride.test.ts`
- `tests/services/rosterReorder.test.ts`
- `tests/e2e/acceptance.test.ts`
- `tests/admin/adminActions.test.ts`

- [x] **Step 3: Annotate preserved `#1` / `#5` helpers with `/** @internal */`**

Add `/** @internal */` JSDoc comments directly above:

- `export interface UpdateQuizDetailsInput` and `export async function updateQuizDetails` in `src/services/quizService.ts`.
- `export function formatEuropeanDate` and `export function formatEuropeanTime` in `src/lib/formatters.ts`.

- [x] **Step 4: Run all affected test suites and TypeScript check**

Run: `npx vitest run tests/services/guestRsvpService.test.ts tests/services/rsvpConcurrency.test.ts tests/services/rsvpAdminOverride.test.ts tests/services/rosterReorder.test.ts tests/e2e/acceptance.test.ts tests/admin/adminActions.test.ts tests/lib/formatters.test.ts && npm run typecheck`  
Expected: PASS (all tests green, 0 TypeScript errors).

---

### Task 3: Clean Up `package.json` Dependencies & Metadata

**Files:**

- Modify: `package.json` (remove `main`, `clsx`, `tailwind-merge`, `eslint-config-next`, verify `@secretlint/quick-start`; add `@next/eslint-plugin-next@^16.4.6` to `devDependencies`)
- Modify: `package-lock.json`

**Interfaces:**

- Consumes: `eslint.config.mjs` (imports `@next/eslint-plugin-next`), `.secretlintrc.json`, `audit-ci.json`.
- Produces: Clean `package.json` & `package-lock.json` with zero unused dependencies or unlisted ESLint imports, and passing `lint`, `scan:secrets`, and `audit:check`.

- [x] **Step 1: Uninstall unused packages and replace `eslint-config-next` with `@next/eslint-plugin-next`**

1. Run: `npm uninstall clsx tailwind-merge eslint-config-next @secretlint/quick-start`
2. Verify whether `npm run scan:secrets` works without `@secretlint/quick-start`:
   - Run: `npm run scan:secrets`
   - If `npm run scan:secrets` fails due to missing `@secretlint/quick-start`, reinstall it with `npm install -D @secretlint/quick-start` and include `"@secretlint/quick-start"` in `knip.json#ignoreDependencies` in Task 4. Otherwise keep it uninstalled.
3. Run: `npm install -D @next/eslint-plugin-next@^16.4.6`
4. Remove `"main": "index.js",` from `package.json`.

- [x] **Step 2: Verify lint, secret scan, and CVE audit pass**

Run: `npm run lint && npm run scan:secrets && npm run audit:check`  
Expected: PASS (all exit `0`, `audit-ci.json` `allowlist` remains `[]`).

---

### Task 4: Update `knip.json`, Gate `check:all`, and Update `tests/unit/knipConfig.test.ts`

**Files:**

- Modify: `tests/unit/knipConfig.test.ts` (update Phase 1 assertions -> Phase 2 config & gate contract)
- Modify: `knip.json`
- Modify: `package.json` (`scripts.check:all`)

**Interfaces:**

- Consumes: Clean source/dependency state from Tasks 1–3.
- Produces: Final `knip.json`, gated `package.json#scripts.check:all`, and passing `npm run knip` + `npm run knip:prod`.

- [x] **Step 1: Update `tests/unit/knipConfig.test.ts` for the Phase 2 config & gate contract (Review Focus #5)**

Update `describe("Knip Configuration Contract (Phase 1)", ...)` -> `describe("Knip Configuration Contract (Phase 2)", ...)` in `tests/unit/knipConfig.test.ts` (keeping the baseline report `describe` block intact):

1. Replace the Phase 1 `ignoreDependencies` check and the Phase 1 `not.toContain("knip")` assertion on `check:all` with assertions enforcing the Phase 2 guardrails:
   - `knipConfig.$schema === "https://unpkg.com/knip@6/schema.json"`
   - `knipConfig.ignore` equals `[]` (never mask `src/` with blanket ignores)
   - `knipConfig.ignoreExportsUsedInFile === true`
   - `knipConfig.ignoreDependencies` includes `"@secretlint/secretlint-rule-preset-recommend"` (and only verified Secretlint tooling gap entries)
   - `pkg.devDependencies?.knip` is defined, `pkg.scripts?.knip === "knip"`, `pkg.scripts?.["knip:prod"] === "knip --production"`, and `pkg.scripts?.["check:all"]` contains both `"npm run knip"` and `"npm run knip:prod"`
2. Keep `"includes CSS stylesheets, scripts, prisma, and tests in knip.json project scope"` asserting `entry` and `project` scopes cleanly (allowing `prisma/**/*.ts` or `prisma/**/*.{ts,prisma}` if verified in Step 4).

- [x] **Step 2: Run `tests/unit/knipConfig.test.ts` to verify the updated gate contract fails prior to updating `knip.json` and `package.json`**

Run: `npx vitest run tests/unit/knipConfig.test.ts`  
Expected: FAIL because `knip.json` still has `ignoreDependencies: []` and lacks `ignoreExportsUsedInFile: true`, and `check:all` lacks `knip` / `knip:prod`.

- [x] **Step 3: Update `knip.json` and `package.json#scripts.check:all`**

1. Update `knip.json`:
   ```json
   {
     "$schema": "https://unpkg.com/knip@6/schema.json",
     "entry": ["scripts/**/*.ts"],
     "project": [
       "src/**/*.{ts,tsx,css}!",
       "scripts/**/*.ts",
       "prisma/**/*.ts",
       "tests/**/*.{ts,tsx}"
     ],
     "ignoreExportsUsedInFile": true,
     "ignore": [],
     "ignoreDependencies": ["@secretlint/secretlint-rule-preset-recommend"]
   }
   ```
   _(Check whether switching `"prisma/**/*.ts"` to `"prisma/**/*.{ts,prisma}"` cleanly resolves the informational `.prisma` hint without introducing new warnings; if so, update both `knip.json` and the corresponding assertion in `tests/unit/knipConfig.test.ts`.)_
2. Update `package.json#scripts.check:all` to:
   `"npm run typecheck && npm run test && npm run lint && npm run format:check && npm run audit:check && npm run scan:secrets && npm run knip && npm run knip:prod"`

- [x] **Step 4: Run `tests/unit/knipConfig.test.ts`, `npm run knip`, and `npm run knip:prod`**

Run: `npx vitest run tests/unit/knipConfig.test.ts && npm run knip && npm run knip:prod`  
Expected: PASS — all tests green, `npm run knip` exits `0`, and `npm run knip:prod` exits `0`.

---

### Task 5: Sync Documentation, Archive `#E.2`, and Run Full End-to-End Quality Gate

**Files:**

- Create: `docs/superpowers/feedback/archive-v2.6.2-completed.md`
- Modify: `docs/roadmap.md` (remove `#E.2` from Value Ranking Summary table and Part 2 Section E)
- Modify: `docs/architecture/overview.md` (Section 6 verification commands)
- Modify: `CHANGELOG.md` (add `## [Unreleased]` entry for Knip Phase 1 & Phase 2 dead-code remediation and gate)

**Interfaces:**

- Consumes: Completed implementation and green `knip` / `knip:prod` outputs from Tasks 1–4.
- Produces: Synchronized docs/roadmap/changelog and 100% passing `npm run check:all`.

- [x] **Step 1: Archive `#E.2` out of `docs/roadmap.md` into `docs/superpowers/feedback/archive-v2.6.2-completed.md`**

1. Create `docs/superpowers/feedback/archive-v2.6.2-completed.md` following the structure of `docs/superpowers/feedback/archive-v2.6.1-completed.md`, summarizing completed `#E.2` (Phase 1 audit baseline + Phase 2 remediation, `resetRegisteredAction` removal, `mockData.ts` removal, `registerTeam`/`unregisterTeam` standardization, `tests/helpers/rsvpLineup.ts` isolation, dependency hygiene, and `check:all` gating).
2. Remove `#E.2` from `docs/roadmap.md` (both the Value Ranking Summary row and Part 2 Section E Item 2), keeping `docs/roadmap.md` clean of completed historical work.

- [x] **Step 2: Update `docs/architecture/overview.md` (Section 6) and `CHANGELOG.md`**

1. In `docs/architecture/overview.md` Section 6 (lines 220–222):
   - Update `npm run knip` description to reflect active default-mode enforcement (removing "Phase 1 audit-only, standalone from `check:all`").
   - Update `npm run check:all` description to include `knip` and `knip:prod` alongside typecheck, tests, lint, formatting, audit, and secret scanning.
2. In `CHANGELOG.md`, add an `## [Unreleased]` section at the top documenting the Knip v6 integration, dead Server Action/code/dependency cleanup, and `check:all` quality gate enforcement.

- [x] **Step 3: Format check / write and run the full `npm run check:all` suite**

Run: `npm run format:check || npm run format:write`  
Run: `npm run check:all`  
Expected: `typecheck`, `test`, `lint`, `format:check`, `audit:check`, `scan:secrets`, `knip`, and `knip:prod` ALL PASS with exit code `0`.

- [x] **Step 4: Complete `documenting-feature-release` gate checklist (without committing or tagging)**

Invoke `documenting-feature-release` to confirm all 6 release documentation gates are satisfied (`CHANGELOG.md`, `docs/roadmap.md`, `DEPLOYMENT.md` / `.env.example` / DB schema / OpenAPI verified unchanged), and explicitly ask the human partner for consent before creating any Git commit or release tag.
