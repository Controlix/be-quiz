# Design Document: Test Suite Modernization (Path A — Real Render & Guard Coverage)

**Date:** 2026-11-22  
**Status:** Implemented  
**Scope:** Small change following Knip Phase 2 (`v2.6.2`) and the `AGENTS.md` High-Value Tests Only rule.

---

## 1. Intent & Why

Historical audit showed that 6 `tests/ui/` files (`adminNav`, `dashboardHeader`, `formDateInputs`, `emptyDashboard`, `actionToolbarRegistration`, `adminFeedbackView`) originated from real bug/feature specs, but were converted into brittle `fs.readFileSync` source-text checks when the repo dropped `jsdom` in favor of Vitest `environment: "node"`. Meanwhile, `tests/ui/adminLayout.test.ts` duplicates a `null` mock instead of exercising `requireAdminSession` with a `USER` role, and `tests/db/schema.test.ts` is an obsolete Day-1 seed smoke test.

Path A removes the dead/duplicate scaffolding and upgrades those 6 UI tests to the repo's established `renderToStaticMarkup` pattern (Architecture Invariant #7) so they execute real components instead of scraping `.tsx` text.

---

## 2. Goals & Non-Goals

### Goals

- **Delete obsolete DB seed smoke test:** Remove `tests/db/schema.test.ts` (and the `prisma/seed.ts` text check in `emptyDashboard.test.ts`).
- **Convert 6 source-scraping UI tests to `renderToStaticMarkup` (`.test.tsx`):**
  1. `tests/ui/adminNav.test.tsx`: Render `<QuizzesDashboard />` with `isAdmin={true}` vs `isAdmin={false}` and verify `href="/admin"` (`Beheer`) only appears for admins (intentionally dropping the `src/app/quizzes/page.tsx` prop scrape and `src/app/admin/page.tsx` link scrape).
  2. `tests/ui/dashboardHeader.test.tsx`: Render `<QuizzesDashboard />` for `href="/auth/logout"`, and `<CapabilitiesProvider><ActionToolbar /></CapabilitiesProvider>` for `€` (no `$`).
  3. `tests/ui/emptyDashboard.test.tsx`: Render `<QuizzesDashboard initialQuizzes={[]} />` vs populated `initialQuizzes` and verify the empty-state CTA (`"Nog geen quizzen gepland"` + `href="/quizzes/new"`).
  4. `tests/ui/formDateInputs.test.tsx`: Render `<CapabilitiesProvider><QuizEntryForm /></CapabilitiesProvider>` (mocking `next/navigation`) and verify European text input placeholders (`DD/MM/JJJJ`, `20:00`) without `type="date"` or `type="time"`.
  5. `tests/ui/actionToolbarRegistration.test.tsx`: Render `<CapabilitiesProvider><ActionToolbar /></CapabilitiesProvider>` across `isRegistered={false}` / `true` (and `emailRegistration` `true` / `false`), verifying the registration, confirm, badge, and cancel buttons.
  6. `tests/ui/adminFeedbackView.test.tsx`: Render `<AdminFeedbackClient />` with sample open and resolved feedback items (with and without screenshots) and verify:
     - open item content renders in the default `"OPEN"` tab while resolved items do not render in the initial list and instead appear in the `Opgelost` tab count,
     - filter tabs (`Openstaand`, `Opgelost`, `Alle`) render with accurate counts, and
     - clickable screenshot thumbnails (`alt="Screenshot voor ..."`, `src`) render only for items with a `screenshot` (the `"Screenshot bekijken"` lightbox is closed on initial render; the `src/app/admin/feedback/page.tsx` auth scrape is dropped in favor of `adminLayout.test.ts`).
- **Fix `tests/ui/adminLayout.test.ts`:** Remove `vi.mock("@/lib/auth")` and instead mock the lower-level boundaries (`cookies()` from `next/headers` and `prisma.session` from `@/lib/db`) so `AdminLayout` → `requireAdminSession` → `getSessionMember` → `validateSession` actually execute end-to-end across missing cookie (`null`), `role: "USER"`, and `role: "ADMIN"` branches.

### Non-Goals

- Adding `jsdom` or `@testing-library/react` (violates Architecture Invariant #7).
- Modifying application source code (`src/`) unless a real bug surfaces.

---

## 3. Approaches Considered

1. **Path A — Convert to `renderToStaticMarkup` + Fix `adminLayout.test.ts` + Drop `schema.test.ts` _(Selected)_:** Preserves regression coverage for all 6 real UI fixes while eliminating brittle `fs.readFileSync` source-scraping.
2. **Path B — Delete All 6 UI Tests Outright:** Fastest, but drops automated regression checks for admin-link visibility, European date input types, and `ActionToolbar` registration states.

---

## 4. Verification

- Run `npm run check:all` (`typecheck`, `vitest run`, `eslint`, `prettier`, `audit-ci`, `secretlint`, `knip`, `knip:prod`) and confirm exit `0`.
