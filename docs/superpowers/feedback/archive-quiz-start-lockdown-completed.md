# Archive: Quiz Start Lockdown & Historical Immutability

- **Status:** Implemented (Unreleased on `feat/quiz-start-lockdown`)
- **Date:** 2026-11-22
- **Spec:** `docs/superpowers/specs/2026-11-08-quiz-start-lockdown-design.md`
- **Plan:** `docs/superpowers/plans/2026-11-22-quiz-start-lockdown.md`

---

## Completed Roadmap Item

### #8 Quiz Start Lockdown & Historical Immutability

- **Original Backlog Item:** Part 1, Item 8 (Data Integrity / Tier 2)
- **Delivered Capabilities:**
  - **Pure Domain Lock Evaluator (`src/lib/quizLock.ts`):** Derived personal RSVP locks (`isPersonalRsvpLocked`) and role-aware mutation locks (`isQuizLockedForUser`) purely from UTC `startsAt`, `QuizStatus`, and `Role` using type-only `@prisma/client` imports for browser safety.
  - **Server-Side Enforcement (`src/services/rsvpService.ts`, `registrationService.ts`, `paymentService.ts`, `src/actions/rsvpActions.ts`, `registrationActions.ts`, `guestActions.ts`):** Enforced `getSessionMember()` authentication and start-time/status locks on personal RSVPs (frozen for all members including admins), guest additions/removals, and registration/payment toggles (`USER` locked, `ADMIN` retained).
  - **UI & Error-Safe Mutations (`src/components/RsvpControl.tsx`, `TeamLineup.tsx`, `ActionToolbar.tsx`, `QuizDetailClient.tsx`):** Replaced interactive personal RSVP buttons with role-aware Dutch status banners once started, fixed reserve-list guest removal visibility when locked, converted locked registration/payment controls to read-only while keeping WhatsApp, Calendar, and post-quiz `QuizRatingWidget` active, and guarded client state updates on `{ success: true }`.
  - **Verification & Docs Sync:** Verified with `tests/lib/quizLock.test.ts`, `tests/actions/quizLockEnforcement.test.ts`, `tests/components/QuizStartLockdownUI.test.tsx`, updated `docs/architecture/roles-and-permissions.md`, and passed `npm run check:all` (83 test files / 300 tests).
