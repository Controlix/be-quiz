# Design Document: Knip Dead Code Remediation & Blocking Quality Gate (Phase 2)

**Date:** 2026-11-22  
**Status:** Reviewed / Ready for Implementation Planning  
**Milestone:** v1.1 Polish & CI/CD Infrastructure (Roadmap Rank 2 / Item E.2 — Phase 2)  
**Related Specs/Issues:** `docs/superpowers/specs/2026-11-22-knip-dead-code-detection-design.md`, `docs/superpowers/audit/knip-baseline-report.md`, `docs/roadmap.md` (#E.2)

---

## 1. Intent & The Why

Phase 1 installed Knip v6, configured `knip.json`, added `npm run knip` and `npm run knip:prod`, and captured the empirical baseline in `docs/superpowers/audit/knip-baseline-report.md`.

Phase 2 resolves every baseline finding across **both** `npm run knip` (default mode) and `npm run knip:prod` (`knip --production`) without losing any essential production code, unit test coverage, or pre-built domain functions needed for upcoming roadmap items (`#1 Edit Quiz Details`), and promotes both Knip checks into `npm run check:all` so future dead exports, orphaned Server Actions, and unused dependencies fail local verification and CI automatically.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals

1. **Eliminate Confirmed Dead Code & Unauthenticated RPC Surface:**
   - Remove the orphaned Server Action `resetRegisteredAction` from `src/actions/registrationActions.ts`.
   - Remove legacy `src/lib/mockData.ts` (`INITIAL_MOCK_QUIZZES`, `TabCategory`) after inlining the `QuizCard` data interface into `src/components/QuizCard.tsx`.
2. **Standardize Canonical Registration Service Names:**
   - Rename `setTeamRegistered` -> `registerTeam` and `adminResetRegistration` -> `unregisterTeam` in `src/services/registrationService.ts`, removing the duplicate `export const` aliases.
   - Update the two active Server Action call sites (`src/actions/registrationActions.ts` and `src/actions/adminActions.ts`).
3. **Clean Up Internal-Only Types:**
   - Remove `export` from single-file interfaces `LoginMember` (`src/components/LoginPinClient.tsx`), `DeclinedMember` (`src/components/TeamLineup.tsx`), `UpdateEventResult` (`src/features/calendar/shared/googleCalendarClient.ts`), and `CalendarEventMappingRecord` (`src/features/calendar/shared/mappingRepository.ts`).
   - Remove the redundant `RsvpWithMember` type alias from `src/services/rsvpService.ts`.
4. **Separate Test-Only Helpers from Production Services:**
   - Move `getRsvpLineup` and `RsvpWithDetails` from `src/services/rsvpService.ts` to `tests/helpers/rsvpLineup.ts` and update the 6 Vitest files that import them.
5. **Preserve Same-File Unit-Tested Helpers & Planned Feature Exports Safely:**
   - Enable `"ignoreExportsUsedInFile": true` in `knip.json` so internal functions exported for direct unit testing (`validateSession`, `markTeamPaid`, `markTeamUnpaid`, `partitionLineup`, `formatReserveBadge`, `extractStorageKey`, `getReferencedStorageKeys`, `parseVisionExtractionResponse`) pass `knip:prod` while still failing if unused internally.
   - Annotate `updateQuizDetails` / `UpdateQuizDetailsInput` (`src/services/quizService.ts`, reserved for `#1 Edit Quiz Details`) and `formatEuropeanDate` / `formatEuropeanTime` (`src/lib/formatters.ts`, reserved for `#1`/`#5` and unit-tested) with `/** @internal */` so `knip:prod` ignores them while `npm run knip` still verifies test coverage.
6. **Clean Up Dependencies, Package Metadata & Tooling Gaps:**
   - Uninstall unused runtime packages `clsx` and `tailwind-merge`.
   - Replace `eslint-config-next` in `package.json` with `@next/eslint-plugin-next` (`^16.4.6`, matching `next`) so `eslint.config.mjs` imports a declared dependency while keeping lint rules identical.
   - Remove stale `"main": "index.js"` from `package.json`.
   - Verify whether `@secretlint/quick-start` is unnecessary for `npm run scan:secrets`; uninstall if unused, and add `@secretlint/secretlint-rule-preset-recommend` to `knip.json#ignoreDependencies` (with a clear comment/reason in the spec/test) since Knip lacks a built-in Secretlint plugin for `.secretlintrc.json`.
7. **Enable Blocking Gate & Sync Docs/Tests:**
   - Add `&& npm run knip && npm run knip:prod` to `package.json#scripts.check:all`.
   - Update `tests/unit/knipConfig.test.ts` to enforce the Phase 2 contract.
   - Archive completed `#E.2` out of `docs/roadmap.md` and update `docs/architecture/overview.md` and `CHANGELOG.md` (following `documenting-feature-release` without committing/tagging unless user consents).

### Non-Goals

- Enabling new ESLint rule presets (`eslint-config-next/core-web-vitals`) that could introduce unrelated React/a11y lint churn.
- Implementing the `#1 Edit Quiz Details` Server Action or UI.
- Rewriting unit tests beyond updating imports for `getRsvpLineup`.

### Anti-Goals

- Adding blanket `ignore` file globs in `knip.json` that mask dead exports in `src/`.
- Deleting `updateQuizDetails`, `getRsvpLineup`, or `formatEuropeanDate`/`formatEuropeanTime` test coverage.

---

## 3. Constraints & Technical Environment

- **Node.js Runtime:** Node.js 22 LTS (`.github/workflows/ci.yml`).
- **Next.js / TypeScript / Vitest:** Next.js `16.4.6`, TypeScript `~6.0.3`, Vitest `^5.0.5` (`environment: "node"`).
- **Zero Allowlist Security Policy:** `audit-ci.json` `allowlist` must remain `[]`.
- **Plan/Spec Sync:** Any changes to `knip.json` and `package.json#scripts.check:all` must update `tests/unit/knipConfig.test.ts` in lockstep.

---

## 4. Approaches Considered & Decision

### Approach 1: Surgical Dead-Code Cleanup + Knip's Built-In Semantics _(Selected)_

- Delete genuinely dead exports/packages (`resetRegisteredAction`, `mockData.ts`, `clsx`, `tailwind-merge`), standardize `registerTeam` / `unregisterTeam`, un-export single-file types, relocate `getRsvpLineup` to `tests/helpers/rsvpLineup.ts`, enable `ignoreExportsUsedInFile: true`, and mark `updateQuizDetails` / `formatEuropeanDate` / `formatEuropeanTime` with `/** @internal */`.
- _Trade-off:_ Zero essential code or tests lost, minimal diff, and both `npm run knip` and `npm run knip:prod` exit `0`. Because `ignoreExportsUsedInFile: true` applies globally across the project, an internal helper accidentally marked `export` inside a `"use server"` file (`src/actions/*.ts`) and called in the same file would not be flagged by Knip; keeping `"use server"` exports restricted strictly to intentional client-invoked actions remains an explicit code-review invariant.

### Approach 2: Zero-Config Strictness (Refactor Unit Tests & Un-Export Everything)

- Keep `ignoreExportsUsedInFile: false` and avoid `@internal` tags by un-exporting all 8 internal helpers, rewriting unit tests to test via higher-level callers, and deleting `formatEuropeanDate`/`Time` + `updateQuizDetails` temporarily.
- _Trade-off:_ Avoids `ignoreExportsUsedInFile` and `@internal`, but forces unnecessary test rewrites and discards prepared `#1 Edit Quiz Details` service code.

---

## 5. Specification: Phase 2 Implementation Details

### 5.1 `knip.json` Updates

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["scripts/**/*.ts"],
  "project": ["src/**/*.{ts,tsx,css}!", "scripts/**/*.ts", "prisma/**/*.ts", "tests/**/*.{ts,tsx}"],
  "ignoreExportsUsedInFile": true,
  "ignore": [],
  "ignoreDependencies": ["@secretlint/secretlint-rule-preset-recommend"]
}
```

_(If `@secretlint/quick-start` is retained instead of uninstalled, include it in `ignoreDependencies`; default expectation is to verify `npm run scan:secrets` works without `@secretlint/quick-start` and uninstall it.)_

### 5.2 Dead Code & Naming Cleanup (`src/` & `tests/`)

1. `src/actions/registrationActions.ts`:
   - Delete `resetRegisteredAction`.
   - Replace `setTeamRegistered` import/call with `registerTeam`.
2. `src/actions/adminActions.ts`:
   - Replace `adminResetRegistration` import/call inside `adminResetRegistrationAction` with `unregisterTeam` (keeping `adminResetRegistrationAction` exported name unchanged for `EditQuizClient.tsx`).
3. `src/services/registrationService.ts`:
   - Rename `setTeamRegistered` -> `registerTeam` and `adminResetRegistration` -> `unregisterTeam`, removing the bottom `export const` aliases.
4. `src/components/QuizCard.tsx` & `src/lib/mockData.ts`:
   - Define `interface QuizCardQuiz` (matching the existing `MockQuiz` fields used by `QuizCard`) directly inside `src/components/QuizCard.tsx` and delete `src/lib/mockData.ts`.
5. Internal-only types (remove `export` keyword):
   - `LoginMember` in `src/components/LoginPinClient.tsx`
   - `DeclinedMember` in `src/components/TeamLineup.tsx`
   - `UpdateEventResult` in `src/features/calendar/shared/googleCalendarClient.ts`
   - `CalendarEventMappingRecord` in `src/features/calendar/shared/mappingRepository.ts`
6. `src/services/rsvpService.ts` -> `tests/helpers/rsvpLineup.ts`:
   - Remove `RsvpWithMember`, `RsvpWithDetails`, and `getRsvpLineup` from `src/services/rsvpService.ts`.
   - Create `tests/helpers/rsvpLineup.ts` exporting `RsvpWithDetails` and `getRsvpLineup(teamId: string)` using `@/lib/db` and `@prisma/client`.
   - Update the 6 test files importing `getRsvpLineup` (`tests/services/guestRsvpService.test.ts`, `tests/services/rsvpConcurrency.test.ts`, `tests/services/rsvpAdminOverride.test.ts`, `tests/services/rosterReorder.test.ts`, `tests/e2e/acceptance.test.ts`, `tests/admin/adminActions.test.ts`).
7. `/** @internal */` annotations (for `knip --production`):
   - `UpdateQuizDetailsInput` and `updateQuizDetails` in `src/services/quizService.ts`.
   - `formatEuropeanDate` and `formatEuropeanTime` in `src/lib/formatters.ts`.

### 5.3 `package.json` & Dependencies

- `npm uninstall clsx tailwind-merge eslint-config-next` (and `@secretlint/quick-start` if verified unnecessary for `npm run scan:secrets`).
- `npm install -D @next/eslint-plugin-next@^16.4.6` (matching Next.js `16.4.6` / `eslint.config.mjs`).
- Remove `"main": "index.js"` from `package.json`.
- Update `"check:all"` in `package.json#scripts`:
  `"check:all": "npm run typecheck && npm run test && npm run lint && npm run format:check && npm run audit:check && npm run scan:secrets && npm run knip && npm run knip:prod"`

### 5.4 Verification & Documentation

- `tests/unit/knipConfig.test.ts`: Update assertions for `ignoreExportsUsedInFile === true`, `ignoreDependencies`, and `check:all` containing both `knip` and `knip:prod`.
- Confirm `npm run lint`, `npm run audit:check` (`audit-ci.json` `allowlist: []`), `npm run scan:secrets`, `npm run knip`, `npm run knip:prod`, and `npm run check:all` all exit `0`.
- Sync `docs/roadmap.md` (removing `#E.2` from both the Value Ranking Summary table and Part 2 Section E), archive `#E.2` into `docs/superpowers/feedback/archive-v2.6.2-completed.md` (keeping released `v2.6.1` archive untouched), and update `docs/architecture/overview.md` (Section 6) and `CHANGELOG.md` (under `## [Unreleased]` until tagged).

---

## 6. What's Left to the Builder

1. Verifying whether `npm run scan:secrets` passes after removing `@secretlint/quick-start`.
2. Checking whether `prisma/**/*.{ts,prisma}` in `knip.json#project` cleanly resolves the informational `.prisma` hint without introducing new warnings.
3. Ensuring no test or typecheck regressions occur when relocating `getRsvpLineup` and renaming `registerTeam`/`unregisterTeam`.
4. Confirming `npm run check:all` passes end-to-end with `knip` and `knip:prod` gated.
