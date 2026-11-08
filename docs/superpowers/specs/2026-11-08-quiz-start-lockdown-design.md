# Design Document: Quiz Start Lockdown & Historical Immutability

- **Date:** 2026-11-08
- **Status:** Draft / In Review
- **Author:** AI Agent & Team
- **Target App Version:** `v2.3.0`

---

## 1. Intent & The Why

In a pub quiz team management application, quizzes pass through distinct lifecycle phases: preparation/registration, active play, and post-event history.

Once a quiz reaches its scheduled start time (`startsAt`), the event is effectively underway:

1. The roster of attending players is physically present at the venue table.
2. Changes to RSVPs ("Ik doe mee" / "Ik pas") or roster reordering after the start time cause confusion and corrupt the historical record of who actually attended.
3. Post-event quizzes serve as an archive. The lineup and quiz details should remain stable, immutable, and preserved for team history and statistics.

To guarantee historical integrity while remaining flexible in real-life edge cases (e.g., last-minute player swaps at the table or correcting a typo in the quiz venue), the system must automatically lock the quiz for regular members at `startsAt` while preserving full override authority for administrators.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **Automatic Time-Based Lockdown:** Automatically freeze RSVPs, lineup order, and quiz details the moment `startsAt` has passed, with zero manual admin action required.
- **Strict Server-Side Enforcement:** Reject unauthorized mutation attempts in server actions and domain services, returning descriptive errors if a non-admin attempts to mutate a started or completed quiz.
- **Intentional Override Distinction (Option 2):**
  - **Personal RSVP Controls:** Freeze the personal RSVP bar ("Ik doe mee" / "Ik pas") for _all_ members (including admins) once `startsAt` has passed to prevent accidental mis-taps.
  - **Administrative Roster Overrides:** Retain explicit per-player lineup overrides (adding/removing players, reordering, and editing event details) exclusively for administrators to handle real-world table substitutions or corrections.
- **Clear Read-Only UI Experience:** Replace interactive RSVP controls on started quizzes with clear, informative status indicators (e.g., _"Quiz gestart — opstelling definitief"_), disable lineup reordering handles for regular members, and present payment/registration flags as informational badges.
- **Pure Node-Based Deterministic Testing:** Provide 100% test coverage for lock helper logic and service layer enforcement without DOM emulation or mock-heavy harnesses.

### Non-Goals

- **Database Status Schema Changes:** We do not introduce new `QuizStatus` enum values (such as `STARTED` or `COMPLETED`) or require Prisma schema migrations for this feature.
- **Scheduled Cron / Worker Tasks:** We do not introduce background cron jobs or scheduled workers to mutate database records at start time.
- **Financial Accounting / Ledger Management:** Payment tracking in the app is strictly an informational badge for participants; this feature does not introduce financial auditing, receipts, or ledger accounting.

### Anti-Goals

- **Client-Only Disabling:** We must never rely solely on client-side disabled buttons. Security and business logic must always be enforced in domain services and server actions.
- **Hard Admin Lockout:** We must never prevent administrators from correcting mistakes or swapping players post-event.
- **Blocking Post-Quiz Ratings:** Locking must not prevent attendees from submitting post-quiz satisfaction ratings (1 to 5 stars) once the quiz is over, as outlined in the ratings spec.

---

## 3. Constraints & Architectural Invariants

- **Runtime Execution:** Must run seamlessly on Vercel Serverless and Node.js container environments without cron or persistent background daemons.
- **Single Source of Truth:** Lock state must be purely derived from `startsAt` and the authenticated member's `role`. No parallel or duplicated local states.
- **Time Zone Consistency:** Time comparison must evaluate UTC timestamps (`startsAt.getTime() <= now.getTime()`).
- **Core Domain Independence:** Domain validation rules must remain in pure domain services (`src/services/` and `src/lib/`) independent of third-party APIs.
- **Zero DOM Test Dependencies:** All lock evaluation logic and service mutations must be verified with Vitest in Node.js environment.

---

## 4. Approaches Considered

### Approach 1: Dynamic Pure Time-Based Domain Rules (Selected)

- **Mechanism:** Derive quiz lock state dynamically by comparing the current UTC timestamp against `quiz.startsAt`. If `now >= quiz.startsAt` and the user is not an `ADMIN`, the quiz is considered locked.
- **Pros:**
  - Zero database schema migrations required.
  - Zero background cron jobs or worker queues needed (ideal for Vercel Serverless).
  - Instant precision down to the exact second of start time.
  - Keeps database state lean and eliminates desync between real time and database flags.
- **Cons:**
  - Requires callers to pass the user's role and event `startsAt` to the evaluation helper.
- **Decision:** Selected as the cleanest, most resilient, and lowest-maintenance approach.

### Approach 2: Database Enum Lifecycle State (`STARTED` / `FINISHED`)

- **Mechanism:** Add new enum values to `QuizStatus` in `prisma/schema.prisma` and trigger state changes via cron or lazy read triggers.
- **Pros:**
  - Static query filtering (`where: { status: 'STARTED' }`).
- **Cons:**
  - Requires database migrations.
  - Cron jobs fit poorly with serverless hosting and introduce synchronization lag.
  - Lazy writes on GET requests violate HTTP semantics and complicate read queries.
- **Decision:** Rejected.

---

## 5. Detailed Design & Specifications

### 5.1 Domain Lock Evaluation Helper (`src/lib/quizLock.ts`)

A pure TypeScript domain helper:

```typescript
export interface QuizLockContext {
  startsAt: Date;
  status?: QuizStatus;
}

/**
 * Checks if personal RSVP actions ("Ik doe mee" / "Ik pas") are locked.
 * Personal RSVPs freeze for ALL members (including admins) once startsAt arrives.
 */
export function isPersonalRsvpLocked(
  quiz: QuizLockContext,
  referenceTime: Date = new Date()
): boolean {
  if (quiz.status === "CANCELLED" || quiz.status === "ARCHIVED") {
    return true;
  }
  return referenceTime.getTime() >= new Date(quiz.startsAt).getTime();
}

/**
 * Checks if general administrative/management operations are locked for the given user role.
 * Admins are never locked out from administrative roster overrides, reordering, or metadata editing.
 */
export function isQuizLockedForUser(
  quiz: QuizLockContext,
  role: Role = Role.USER,
  referenceTime: Date = new Date()
): boolean {
  if (role === Role.ADMIN) {
    return false;
  }

  return isPersonalRsvpLocked(quiz, referenceTime);
}
```

### 5.2 Service Layer & Server Action Enforcement

The following service operations and server actions validate lock state and enforce permissions:

1. **Personal RSVP Actions (`joinQuizRsvpAction`, `declineQuizRsvpAction`):**
   - Evaluates `isPersonalRsvpLocked(quiz)`.
   - Blocked for **all** members (including admins) once `startsAt` has passed. Returns: `{ success: false, error: "Deze quiz is al gestart. De opstelling is definitief." }`.
2. **Admin Lineup Overrides (`adminOverrideDeclineAction`, `adminOverrideAttendAction`, `adminReorderRsvpAction`):**
   - Strictly restricted to `ADMIN` role.
   - Remains executable at all times, allowing admins to adjust the lineup for table substitutions.
3. **Quiz Details Updates (`quizService.ts` & `quizActions.ts`):**
   - Restricted to `ADMIN` role.
   - Remains executable by admins at all times to correct typos or event notes.
4. **Registration & Payment Actions (`registrationService.ts`, `paymentService.ts`):**
   - Blocked for regular users once `startsAt` has passed. Admins retain capability to toggle these informational flags.

### 5.3 Presentation & UI Adaptations

1. **Personal RSVP Controls (`QuizDetailClient.tsx` & `RsvpControl.tsx`):**
   - Once `startsAt` has passed, the interactive "Ik doe mee" / "Ik pas" button bar is hidden for **everyone** (including admins).
   - In its place, a clear status banner is shown:
     - 🔒 _"Quiz gestart — opstelling definitief"_
     - For regular users: _"De inschrijvingen zijn gesloten. Wijzigingen kunnen enkel door een beheerder worden doorgevoerd."_
     - For admins: _"Inschrijvingen gesloten. Als beheerder kun je hieronder spelers handmatig aanpassen of wisselen."_
2. **Team Lineup (`TeamLineup.tsx`):**
   - **For regular users:** Lineup is purely static (no drag handles, no override actions).
   - **For admins:** Drag handles and per-player override buttons (`Verwijder`, `Zet op reserve`, etc.) remain active and visible in the roster list.
3. **Action Toolbar (`ActionToolbar.tsx`):**
   - Registration and Payment action buttons:
     - For regular users: displayed as read-only status pills or disabled buttons when quiz has started.
     - For admins: remain interactive.
   - Calendar & WhatsApp sharing:
     - Remain accessible for convenience (e.g. sharing the lineup during or after the quiz).

---

## 6. What Is Left to the Builder

The builder has discretion over:

1. Exact Tailwind color scheme and typography for the locked badge banner (e.g. amber/slate neutral badge matching the app's existing theme).
2. The specific placement of `isQuizLockedForUser` (e.g. in `src/lib/quizLock.ts` or exported directly from `src/services/quizService.ts`).
3. Minor copy polish for Dutch user-facing messages.
