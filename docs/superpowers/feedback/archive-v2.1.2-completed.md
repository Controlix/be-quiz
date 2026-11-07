# Milestone v2.1.2 Archive — App Header Team Name Branding & Neutral Seed

**Archived Date:** 2026-11-07  
**App Version:** `v2.1.2`  
**Related Specs & Plans:**

- Implementation Plan: `docs/superpowers/plans/2026-11-07-app-header-team-name.md`
- Documentation Guide: `docs/integrations.md`

---

## Completed Roadmap Items

### 9. App Header Team Name Branding & Neutral Seed

- **Delivered:**
  - Updated `QuizzesDashboard.tsx` to dynamically display the team name configured in `TeamSetting` via `getDefaultTeamName()` in `src/services/quizService.ts`, falling back to `"KwisVrienden"` if empty or unconfigured.
  - Updated `prisma/seed.ts` and `prisma/schema.prisma` defaults to initialize with the neutral placeholder `"Onze Quizploeg"` rather than a specific team name (`"Ben in Black"`).
  - Maintained full architectural compatibility with future multi-tenant / multi-team quiz setups by keeping the decoupled `Team` relation on `Quiz`.
- **Verification:** Unit tests in `tests/services/defaultTeamName.test.ts`, component tests in `tests/components/QuizzesDashboardHeader.test.tsx`, and updated seed assertions in `tests/ui/emptyDashboard.test.ts`.
