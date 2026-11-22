# Knip Dead Code & Unused Export Baseline Report (Phase 1)

**Date:** 2026-11-22  
**Knip Version:** `6.47.0` (`knip.json` using `https://unpkg.com/knip@6/schema.json`)  
**Runtime / Toolchain:** Node.js 22 LTS, Next.js `16.4.6`, TypeScript `~6.0.3` (`moduleResolution: "bundler"`), Vitest `^5.0.5`  
**Phase 1 Scope:** Audit-only baseline. Zero application source files (`src/`) were modified or deleted, `ignore` / `ignoreDependencies` remain empty (`[]`), and `npm run check:all` remains unchanged until Phase 2 remediation.

---

## 1. Plugin & Entry Point Verification (`npx knip --debug`)

- **Auto-Enabled Plugins (15):** `ESLint`, `GitHub Actions`, `husky`, `lint-staged`, `Next.js`, `Node.js`, `PostCSS`, `Prettier`, `Prisma`, `Tailwind`, `tsx`, `TypeScript`, `Vercel OG`, `Vite`, `Vitest`.
- **Verified Entry Resolution:**
  - All Next.js App Router pages, layouts, and route handlers (`src/app/api/**/route.ts`, `src/app/auth/join/route.ts`, `src/app/auth/logout/route.ts`), `src/proxy.ts`, `src/instrumentation.ts`, and `next.config.ts`.
  - Database seed (`prisma/seed.ts`) and schema (`prisma/schema.prisma`).
  - Utility scripts (`scripts/prune-uploads.ts`, `scripts/release-stats.ts`).
  - Vitest configuration (`vitest.config.ts`) and test files (`tests/**/*.test.{ts,tsx}`).
- **Verified Stylesheet Compilation:** `src/app/globals.css` (`@import "tailwindcss";`) compiled cleanly via the `Tailwind` compiler (`tailwindcss` was **not** falsely reported as unused).
- **Production Scope Note (`src/**/*.{ts,tsx,css}!`):** Adding Knip's `!` production suffix on `src/` in `knip.json` is required so `npm run knip:prod` (`knip --production`) follows imports across `src/actions`, `src/services`, `src/components`, `src/features`, and `src/lib`.

---

## 2. Default Mode Findings (`npm run knip`)

Includes production source files, `scripts/**/*.ts`, `prisma/**/*.ts`, `tests/**/*.{ts,tsx}`, `dependencies`, and `devDependencies`.

### Unused files

- None (`0` unused files).

### Unused exports (2) & Unused exported types (6)

| Kind                               | Symbol                       | Location                                                    | Notes                                        |
| :--------------------------------- | :--------------------------- | :---------------------------------------------------------- | :------------------------------------------- |
| Unused export (`function`)         | `resetRegisteredAction`      | `src/actions/registrationActions.ts:17:23`                  | Orphaned Server Action (public RPC endpoint) |
| Unused export                      | `INITIAL_MOCK_QUIZZES`       | `src/lib/mockData.ts:20:14`                                 | Legacy mock fixture                          |
| Unused exported type (`interface`) | `LoginMember`                | `src/components/LoginPinClient.tsx:8:18`                    | Potentially used only within same file       |
| Unused exported type (`interface`) | `DeclinedMember`             | `src/components/TeamLineup.tsx:18:18`                       | Potentially used only within same file       |
| Unused exported type (`interface`) | `UpdateEventResult`          | `src/features/calendar/shared/googleCalendarClient.ts:4:18` | Potentially used only within same file       |
| Unused exported type (`interface`) | `CalendarEventMappingRecord` | `src/features/calendar/shared/mappingRepository.ts:3:18`    | Potentially used only within same file       |
| Unused exported type (`type`)      | `TabCategory`                | `src/lib/mockData.ts:1:13`                                  | Legacy mock type                             |
| Unused exported type (`type`)      | `RsvpWithMember`             | `src/services/rsvpService.ts:9:13`                          | Potentially used only within same file       |

### Unused dependencies (2) & Unused devDependencies (3)

| Type              | Package                                        | Location            | Classification                                                                                                                                                     |
| :---------------- | :--------------------------------------------- | :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dependencies`    | `clsx`                                         | `package.json:49:6` | Removal candidate (verify usage in Phase 2)                                                                                                                        |
| `dependencies`    | `tailwind-merge`                               | `package.json:56:6` | Removal candidate (verify usage in Phase 2)                                                                                                                        |
| `devDependencies` | `@secretlint/quick-start`                      | `package.json:59:6` | **Expected Secretlint tooling exception** — evaluate alongside `.secretlintrc.json` (Knip lacks a built-in Secretlint plugin)                                      |
| `devDependencies` | `@secretlint/secretlint-rule-preset-recommend` | `package.json:60:6` | **Expected Secretlint tooling exception** — referenced dynamically by `.secretlintrc.json` (`"id": "@secretlint/secretlint-rule-preset-recommend"`); do NOT remove |
| `devDependencies` | `eslint-config-next`                           | `package.json:68:6` | Installed for Next.js ESLint rules, while `eslint.config.mjs` imports `@next/eslint-plugin-next` directly                                                          |

### Unlisted dependencies (1)

| Package                    | Imported At              | Classification                                                                                                                                                      |
| :------------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@next/eslint-plugin-next` | `eslint.config.mjs:1:24` | Transitive dependency of `eslint-config-next` imported directly in `eslint.config.mjs`; declare explicitly or switch to `eslint-config-next` flat preset in Phase 2 |

### Additional Default Mode Observations

- **Duplicate exports (2):** `setTeamRegistered|registerTeam` and `adminResetRegistration|unregisterTeam` in `src/services/registrationService.ts`.
- **Configuration hints (2):**
  - `.prisma`: `Compiled extension excluded by knip.json -> project (imports not followed)` (informational; `prisma/schema.prisma` is still compiled as an entry via the Prisma plugin).
  - `index.js`: `Package entry file not found in package.json` (legacy `"main": "index.js"` field in `package.json`).

---

## 3. Production Mode Findings (`npm run knip:prod`)

Runs `knip --production`, excluding `tests/**/*.{ts,tsx}`, `scripts/**/*.ts`, and `devDependencies` so production-only dead code and test-only exports are exposed.

### Unused files

- None (`0` unused files).

### Unused exports (16) & Unused exported types (8)

In addition to the 2 exports and 6 types reported in default mode, production mode surfaced **14 additional exports** and **2 additional exported types** that are only referenced by `tests/`, `scripts/`, or internally within their own module:

| Kind                               | Symbol                                                                                                              | Location                                    | Phase 2 Triage Context                                                    |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :------------------------------------------ | :------------------------------------------------------------------------ |
| Unused export (`function`)         | `resetRegisteredAction`                                                                                             | `src/actions/registrationActions.ts:17:23`  | Confirmed orphaned Server Action                                          |
| Unused export (`function`)         | `formatReserveBadge`                                                                                                | `src/components/TeamLineup.tsx:24:17`       | Check if only used internally + by unit tests                             |
| Unused export (`function`)         | `partitionLineup`                                                                                                   | `src/components/TeamLineup.tsx:28:17`       | Check if only used internally + by unit tests                             |
| Unused export (`function`)         | `validateSession`                                                                                                   | `src/lib/auth.ts:53:23`                     | Check if test-only or internal-only export                                |
| Unused export (`function`)         | `formatEuropeanDate`                                                                                                | `src/lib/formatters.ts:4:17`                | Check if test-only or internal-only export                                |
| Unused export (`function`)         | `formatEuropeanTime`                                                                                                | `src/lib/formatters.ts:10:17`               | Check if test-only or internal-only export                                |
| Unused export                      | `INITIAL_MOCK_QUIZZES`                                                                                              | `src/lib/mockData.ts:20:14`                 | Legacy mock fixture                                                       |
| Unused export (`function`)         | `extractStorageKey`                                                                                                 | `src/lib/storagePruner.ts:25:17`            | Check usage by `scripts/prune-uploads.ts` vs internal/test                |
| Unused export (`function`)         | `getReferencedStorageKeys`                                                                                          | `src/lib/storagePruner.ts:56:23`            | Used by `scripts/prune-uploads.ts` (CLI script, non-prod entry) and tests |
| Unused export (`function`)         | `markTeamPaid`                                                                                                      | `src/services/paymentService.ts:4:23`       | Check if used internally (`toggleFeePayment`) + tests                     |
| Unused export (`function`)         | `markTeamUnpaid`                                                                                                    | `src/services/paymentService.ts:21:23`      | Check if used internally (`toggleFeePayment`) + tests                     |
| Unused export (`function`)         | `updateQuizDetails`                                                                                                 | `src/services/quizService.ts:183:23`        | Unwired service helper / test-only export                                 |
| Unused export                      | `registerTeam`                                                                                                      | `src/services/registrationService.ts:38:14` | Duplicate alias of `setTeamRegistered`                                    |
| Unused export                      | `unregisterTeam`                                                                                                    | `src/services/registrationService.ts:39:14` | Duplicate alias of `adminResetRegistration`                               |
| Unused export (`function`)         | `getRsvpLineup`                                                                                                     | `src/services/rsvpService.ts:11:23`         | Check if test-only or replaced by page queries                            |
| Unused export (`function`)         | `parseVisionExtractionResponse`                                                                                     | `src/services/visionService.ts:17:17`       | Check if used internally + by unit tests                                  |
| Unused exported type (`interface`) | `UpdateQuizDetailsInput`                                                                                            | `src/services/quizService.ts:169:18`        | Paired with `updateQuizDetails`                                           |
| Unused exported type (`type`)      | `RsvpWithDetails`                                                                                                   | `src/services/rsvpService.ts:5:13`          | Paired with `getRsvpLineup` / `rsvpService`                               |
| _(+ 6 types from default mode)_    | `LoginMember`, `DeclinedMember`, `UpdateEventResult`, `CalendarEventMappingRecord`, `TabCategory`, `RsvpWithMember` | _(see Section 2)_                           | Same-file or legacy mock types                                            |

### Unused dependencies (2)

- `clsx` (`package.json:49:6`)
- `tailwind-merge` (`package.json:56:6`)

### Unlisted dependencies

- None (`0` unlisted dependencies).

---

## 4. Phase 2 Triage Recommendations

1. **Confirmed Dead Code & Legacy Fixtures:**
   - Remove orphaned Server Action `resetRegisteredAction` from `src/actions/registrationActions.ts` (high priority — eliminates unauthenticated RPC surface).
   - Remove or archive unused `src/lib/mockData.ts` exports (`INITIAL_MOCK_QUIZZES`, `TabCategory`).
   - Consolidate duplicate aliases (`registerTeam` / `unregisterTeam`) in `src/services/registrationService.ts`.
   - Audit `updateQuizDetails` / `UpdateQuizDetailsInput` (`src/services/quizService.ts`) and `getRsvpLineup` / `RsvpWithDetails` (`src/services/rsvpService.ts`) to remove dead exports or keep only what is required by planned `#1 Edit Quiz Details`.
2. **Same-File & Test-Only Exports:**
   - Evaluate whether `ignoreExportsUsedInFile: true` in `knip.json` is appropriate for internal helper types (`LoginMember`, `DeclinedMember`, `UpdateEventResult`, `CalendarEventMappingRecord`, `RsvpWithMember`) and internal helpers, or drop unnecessary `export` keywords where unit tests can test via public entry points.
3. **Dependency & Config Hygiene:**
   - Remove unused `clsx` and `tailwind-merge` from `package.json` if confirmed unused.
   - Align `eslint-config-next` vs `@next/eslint-plugin-next` in `package.json` and `eslint.config.mjs`.
   - Remove stale `"main": "index.js"` in `package.json` (eliminates the `index.js` configuration hint).
   - Add `"@secretlint/secretlint-rule-preset-recommend"` (and `"@secretlint/quick-start"` if retained) to `ignoreDependencies` in `knip.json` **only after** verifying `.secretlintrc.json` usage in Phase 2, then add `npm run knip` to `npm run check:all`.
