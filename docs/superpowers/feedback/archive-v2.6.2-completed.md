# Archive: v2.6.2 Completed Features & Implementation Notes

- **Release Version:** `v2.6.2`
- **Release Date:** 2026-11-22
- **Focus:** Automated Dead Code & Unused Export Detection + Blocking Quality Gate (Knip Phase 1 & Phase 2)

---

## Completed Roadmap Items

### #E.2 Automated Dead Code & Unused Export Detection (Knip Integration)

- **Original Backlog Item:** Part 2, Section E, Item 2 (Code Quality / CI & Tooling)
- **Status:** Shipped (`v2.6.2`)
- **Specs & Plans:**
  - Phase 1 Design & Plan: `docs/superpowers/specs/2026-11-22-knip-dead-code-detection-design.md`, `docs/superpowers/plans/2026-11-22-knip-dead-code-detection-phase-1.md`
  - Baseline Audit Report: `docs/superpowers/audit/knip-baseline-report.md`
  - Phase 2 Design & Plan: `docs/superpowers/specs/2026-11-22-knip-phase-2-remediation-design.md`, `docs/superpowers/plans/2026-11-22-knip-phase-2-remediation.md`
- **Delivered Capabilities:**
  - **Whole-Project Static Analysis (`knip.json`):** Configured Knip v6 with Next.js App Router, Vitest, Prisma, ESLint, PostCSS, Prettier, Tailwind, husky, and lint-staged plugins, `"ignoreExportsUsedInFile": true`, zero blanket `ignore` globs, and explicit Secretlint preset exception (`@secretlint/secretlint-rule-preset-recommend`).
  - **Dead Server Action & Legacy Fixture Removal:** Deleted the orphaned unauthenticated Server Action `resetRegisteredAction` (`src/actions/registrationActions.ts`), inlined `QuizCardQuiz` into `src/components/QuizCard.tsx`, and removed `src/lib/mockData.ts`.
  - **Canonical Registration Service Naming:** Standardized `registerTeam` and `unregisterTeam` in `src/services/registrationService.ts`, removing duplicate aliases and updating `registrationActions.ts` and `adminActions.ts`.
  - **Test-Only Helper & `@internal` Isolation:** Relocated `getRsvpLineup` and `RsvpWithDetails` to `tests/helpers/rsvpLineup.ts`, removed redundant `RsvpWithMember`, un-exported single-file interfaces (`LoginMember`, `DeclinedMember`, `UpdateEventResult`, `CalendarEventMappingRecord`), and annotated planned `#1`/`#5` helpers (`updateQuizDetails`, `UpdateQuizDetailsInput`, `formatEuropeanDate`, `formatEuropeanTime`) with `/** @internal */`.
  - **Dependency Hygiene & Blocking Gate:** Uninstalled unused `clsx`, `tailwind-merge`, `eslint-config-next`, and `@secretlint/quick-start`, installed `@next/eslint-plugin-next@^16.4.6`, removed stale `"main": "index.js"`, and gated `npm run check:all` on both `npm run knip` and `npm run knip:prod`.
