# Quiz Start Lockdown & Historical Immutability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically freeze personal RSVPs for all members and restrict roster, guest, registration, and payment mutations for regular users once a quiz's `startsAt` timestamp arrives (or when cancelled/archived), while preserving full administrative override authority and post-quiz rating eligibility.

**Architecture:** Introduce a pure UTC time-and-status evaluator (`src/lib/quizLock.ts`) as the single source of truth for lock state. Enforce personal RSVP locks (`isPersonalRsvpLocked`) in `rsvpService.setRsvp` and `rsvpActions`, enforce role-aware mutation locks (`isQuizLockedForUser`) in `registrationService`, `paymentService`, `registrationActions`, and `guestActions`, and adapt `RsvpControl`, `TeamLineup`, `ActionToolbar`, and `QuizDetailClient` with error-safe state updates and clear Dutch status banners.

**Tech Stack:** Next.js 16 (App Router, RSC, Server Actions), React 19, TypeScript 6, Prisma 6 + PostgreSQL, Tailwind CSS v4, Vitest 5 (`environment: "node"`).

**Spec:** `docs/superpowers/specs/2026-11-08-quiz-start-lockdown-design.md`

## Global Constraints

- Vitest runs strictly under `environment: "node"` (`vitest.config.ts`); component tests MUST use `renderToStaticMarkup` from `react-dom/server` without `jsdom` or `@testing-library/react`.
- Zero Prisma schema migrations and zero cron jobs or background workers; lock state MUST be derived purely from UTC `startsAt`, `QuizStatus`, and `Role`.
- Server Actions MUST validate the session via `getSessionMember()`, enforce lock rules server-side (never trusting client-supplied `memberId` or `isAdmin`), and wrap `revalidatePath` calls inside dedicated inner `try { ... } catch {}` blocks.
- Client mutations in `QuizDetailClient.tsx` MUST await `{ success: true }` before updating reducer/component state (no unguarded optimistic updates).
- NEVER run `git commit` without explicit user consent.
- Check off each step (`- [x]`) in this plan immediately upon completion before moving to the next step.

## Review Focus

1. **Exact `startsAt` boundary (`now === startsAt`):** At the exact millisecond `referenceTime.getTime() === startsAt.getTime()`, `isPersonalRsvpLocked` and `isQuizLockedForUser(..., "USER")` MUST evaluate to `true` (locked), while `isQuizLockedForUser(..., "ADMIN")` evaluates to `false` (tested in Task 1).
2. **`CANCELLED` and `ARCHIVED` quizzes before `startsAt`:** Even when `startsAt` is still in the future, `CANCELLED` or `ARCHIVED` quizzes MUST freeze personal RSVPs for everyone and lock regular users out of mutations while allowing `ADMIN` overrides (tested in Tasks 1 & 2).
3. **Player Dual-Identity personal RSVP freeze for admins:** When `startsAt` has passed, `joinQuizRsvpAction` and `declineQuizRsvpAction` MUST reject even an authenticated `ADMIN` with `"Deze quiz is al gestart. De opstelling is definitief."`, while `adminOverrideDeclineAction`, `adminOverrideAttendAction`, `adminReorderRsvpAction`, `setRegisteredAction`, and `toggleFeePaidAction` remain executable by `ADMIN` (tested in Tasks 2 & 3).
4. **Reserve-list guest removal lockdown & unauthenticated RPC rejection:** Non-admin guest inviters MUST NOT see or execute guest removal (`Verwijderen`) on either active OR reserve lineup entries once locked, and all RSVP/registration/payment Server Actions MUST reject unauthenticated callers (`getSessionMember() === null`) (tested in Tasks 2 & 3).
5. **Post-quiz rating continuity & auxiliary sharing preservation:** When a quiz has both started and concluded, `QuizRatingWidget` (`"Hoe was deze quiz?"`) MUST remain interactive for eligible starting-lineup players, and `ActionToolbar` WhatsApp / Calendar links MUST remain accessible even while personal RSVPs and registration/payment toggles are locked (tested in Task 3).

---

### Task 1: Pure Domain Lock Helper (`src/lib/quizLock.ts`)

**Files:**

- Create: `src/lib/quizLock.ts`
- Test: `tests/lib/quizLock.test.ts`

**Interfaces:**

- Produces in `@/lib/quizLock`:
  - `export interface QuizLockContext { startsAt: Date | string; status?: QuizStatus; }`
  - `export const QUIZ_LOCKED_RSVP_ERROR = "Deze quiz is al gestart. De opstelling is definitief.";`
  - `export const QUIZ_LOCKED_MUTATION_ERROR = "Quiz is al gestart en vergrendeld voor wijzigingen.";`
  - `export function isPersonalRsvpLocked(quiz: QuizLockContext, referenceTime?: Date): boolean`
  - `export function isQuizLockedForUser(quiz: QuizLockContext, role?: Role, referenceTime?: Date): boolean`

- [x] **Step 1: Write the failing unit tests in `tests/lib/quizLock.test.ts`**

Create `tests/lib/quizLock.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isPersonalRsvpLocked, isQuizLockedForUser } from "../../src/lib/quizLock";

describe("quizLock domain helper", () => {
  const start = new Date("2026-11-22T20:00:00.000Z");

  it("returns false before startsAt for OPEN quizzes", () => {
    const before = new Date("2026-11-22T19:59:59.999Z");
    const quiz = { startsAt: start, status: "OPEN" as const };

    expect(isPersonalRsvpLocked(quiz, before)).toBe(false);
    expect(isQuizLockedForUser(quiz, "USER", before)).toBe(false);
    expect(isQuizLockedForUser(quiz, "ADMIN", before)).toBe(false);
  });

  // Review Focus #1: Exact startsAt boundary
  it("locks personal RSVP and regular users at exact startsAt timestamp while keeping ADMIN unlocked", () => {
    const exactStart = new Date("2026-11-22T20:00:00.000Z");
    const quiz = { startsAt: start, status: "OPEN" as const };

    expect(isPersonalRsvpLocked(quiz, exactStart)).toBe(true);
    expect(isQuizLockedForUser(quiz, "USER", exactStart)).toBe(true);
    expect(isQuizLockedForUser(quiz, "ADMIN", exactStart)).toBe(false);
  });

  it("locks personal RSVP and regular users after startsAt while keeping ADMIN unlocked", () => {
    const after = new Date("2026-11-22T20:05:00.000Z");
    const quiz = { startsAt: start, status: "OPEN" as const };

    expect(isPersonalRsvpLocked(quiz, after)).toBe(true);
    expect(isQuizLockedForUser(quiz, "USER", after)).toBe(true);
    expect(isQuizLockedForUser(quiz, "ADMIN", after)).toBe(false);
  });

  // Review Focus #2: CANCELLED and ARCHIVED quizzes before startsAt
  it("locks CANCELLED and ARCHIVED quizzes even when startsAt is in the future, except for ADMIN management", () => {
    const before = new Date("2026-11-22T18:00:00.000Z");

    expect(isPersonalRsvpLocked({ startsAt: start, status: "CANCELLED" }, before)).toBe(true);
    expect(isPersonalRsvpLocked({ startsAt: start, status: "ARCHIVED" }, before)).toBe(true);
    expect(isQuizLockedForUser({ startsAt: start, status: "CANCELLED" }, "USER", before)).toBe(
      true
    );
    expect(isQuizLockedForUser({ startsAt: start, status: "ARCHIVED" }, "USER", before)).toBe(true);
    expect(isQuizLockedForUser({ startsAt: start, status: "CANCELLED" }, "ADMIN", before)).toBe(
      false
    );
    expect(isQuizLockedForUser({ startsAt: start, status: "ARCHIVED" }, "ADMIN", before)).toBe(
      false
    );
  });

  it("accepts ISO string startsAt values from serialized RSC payloads", () => {
    const after = new Date("2026-11-22T21:00:00.000Z");
    expect(isPersonalRsvpLocked({ startsAt: "2026-11-22T20:00:00.000Z" }, after)).toBe(true);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/quizLock.test.ts`
Expected: FAIL with module resolution error (`Cannot find module '../../src/lib/quizLock'`).

- [x] **Step 3: Implement `src/lib/quizLock.ts`**

- Create `src/lib/quizLock.ts` using **type-only** imports (`import type { QuizStatus, Role } from "@prisma/client"`) so client components importing this module never bundle `@prisma/client` runtime code. Export `QuizLockContext`, `QUIZ_LOCKED_RSVP_ERROR`, `QUIZ_LOCKED_MUTATION_ERROR`, `isPersonalRsvpLocked`, and `isQuizLockedForUser`:

- `isPersonalRsvpLocked(quiz, referenceTime = new Date())`: returns `true` if `quiz.status === "CANCELLED" || quiz.status === "ARCHIVED"`, otherwise `referenceTime.getTime() >= new Date(quiz.startsAt).getTime()`.
- `isQuizLockedForUser(quiz, role: Role = "USER", referenceTime = new Date())`: returns `false` when `role === "ADMIN"`, otherwise delegates to `isPersonalRsvpLocked(quiz, referenceTime)`.

- [x] **Step 4: Run the unit test to verify it passes**

Run: `npx vitest run tests/lib/quizLock.test.ts`
Expected: PASS (5 tests passing).

---

### Task 2: Domain Services & Server Actions Lockdown Enforcement

**Files:**

- Modify: `src/services/rsvpService.ts:1-67`
- Modify: `src/services/registrationService.ts:1-36`
- Modify: `src/services/paymentService.ts:38-53`
- Modify: `src/actions/rsvpActions.ts:1-50`
- Modify: `src/actions/registrationActions.ts:1-25`
- Modify: `src/actions/guestActions.ts:1-111`
- Modify: `tests/services/ratingService.test.ts:11-58` (and any other concluded-quiz `setRsvp` fixture setup in that file)
- Modify: `tests/actions/rsvpRatingSync.test.ts:1-60`
- Create: `tests/actions/quizLockEnforcement.test.ts`

**Interfaces:**

- Consumes from `@/lib/quizLock`: `isPersonalRsvpLocked`, `isQuizLockedForUser`, `QUIZ_LOCKED_RSVP_ERROR`, `QUIZ_LOCKED_MUTATION_ERROR`
- Produces in `@/services/rsvpService`: `setRsvp(teamId: string, memberId: string, status: "ATTENDING" | "DECLINED"): Promise<void>` (now rejects with `QUIZ_LOCKED_RSVP_ERROR` when `isPersonalRsvpLocked(team.quiz)` is `true`)
- Produces in `@/services/registrationService`: `registerTeam(teamId: string, memberId: string, actorRole?: Role): Promise<void>` (defaults `actorRole = "USER"`, rejects with `QUIZ_LOCKED_MUTATION_ERROR` when `isQuizLockedForUser(team.quiz, actorRole)` is `true`)
- Produces in `@/services/paymentService`: `toggleFeePayment(teamId: string, memberId: string, actorRole?: Role): Promise<boolean>` (defaults `actorRole = "USER"`, rejects with `QUIZ_LOCKED_MUTATION_ERROR` when `isQuizLockedForUser(team.quiz, actorRole)` is `true`)
- Produces in `@/actions/rsvpActions`: `joinQuizRsvpAction(teamId: string, _memberId?: string, quizId?: string)` and `declineQuizRsvpAction(teamId: string, _memberId?: string, quizId?: string)` (authenticated via `getSessionMember()`, using `sessionMember.id`)
- Produces in `@/actions/registrationActions`: `setRegisteredAction(teamId: string, _memberId?: string)` and `toggleFeePaidAction(teamId: string, _memberId?: string)` (authenticated via `getSessionMember()`, passing `sessionMember.id` and `sessionMember.role`)

- [x] **Step 1: Write the failing integration & enforcement tests in `tests/actions/quizLockEnforcement.test.ts`**

Create `tests/actions/quizLockEnforcement.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../src/lib/db";
import * as auth from "../../src/lib/auth";
import { joinQuizRsvpAction, declineQuizRsvpAction } from "../../src/actions/rsvpActions";
import { setRegisteredAction, toggleFeePaidAction } from "../../src/actions/registrationActions";
import { addGuestAction, removeGuestAction } from "../../src/actions/guestActions";
import {
  adminOverrideDeclineAction,
  adminOverrideAttendAction,
} from "../../src/actions/adminActions";
import { adminReorderRsvpAction } from "../../src/actions/reorderActions";
import { QUIZ_LOCKED_RSVP_ERROR, QUIZ_LOCKED_MUTATION_ERROR } from "../../src/lib/quizLock";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Quiz Start Lockdown Server Enforcement", () => {
  let regularUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let adminUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let futureQuiz: { id: string; team: { id: string } };
  let startedQuiz: { id: string; team: { id: string } };
  let cancelledFutureQuiz: { id: string; team: { id: string } };
  let archivedFutureQuiz: { id: string; team: { id: string } };

  beforeEach(async () => {
    vi.restoreAllMocks();
    const suffix = `${Date.now()}-${Math.random()}`;

    regularUser = await prisma.member.create({
      data: { name: `User-${suffix}`, role: "USER" },
    });
    adminUser = await prisma.member.create({
      data: { name: `Admin-${suffix}`, role: "ADMIN" },
    });

    futureQuiz = (await prisma.quiz.create({
      data: {
        title: "Future Open Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    })) as any;

    startedQuiz = (await prisma.quiz.create({
      data: {
        title: "Started Quiz",
        startsAt: new Date(Date.now() - 60000),
        location: "Antwerpen",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 1 } },
      },
      include: { team: true },
    })) as any;

    cancelledFutureQuiz = (await prisma.quiz.create({
      data: {
        title: "Cancelled Future Quiz",
        startsAt: new Date(Date.now() + 86400000),
        status: "CANCELLED",
        location: "Brugge",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    })) as any;

    archivedFutureQuiz = (await prisma.quiz.create({
      data: {
        title: "Archived Future Quiz",
        startsAt: new Date(Date.now() + 86400000),
        status: "ARCHIVED",
        location: "Leuven",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    })) as any;
  });

  // Review Focus #4: Unauthenticated RPC rejection
  it("rejects unauthenticated requests for RSVP, registration, payment, and guest actions", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);

    const joinRes = await joinQuizRsvpAction(futureQuiz.team.id, regularUser.id, futureQuiz.id);
    const declineRes = await declineQuizRsvpAction(
      futureQuiz.team.id,
      regularUser.id,
      futureQuiz.id
    );
    const regRes = await setRegisteredAction(futureQuiz.team.id, regularUser.id);
    const payRes = await toggleFeePaidAction(futureQuiz.team.id, regularUser.id);
    const addGuestRes = await addGuestAction(futureQuiz.team.id, "Sarah");
    const removeGuestRes = await removeGuestAction("non-existent-rsvp-id", futureQuiz.team.id);

    expect(joinRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(declineRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(regRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(payRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(addGuestRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(removeGuestRes).toEqual({ success: false, error: "Niet ingelogd" });
  });

  // Review Focus #3: Personal RSVP frozen for ALL members (including ADMIN) after startsAt
  it("blocks personal RSVP join/decline for both USER and ADMIN once quiz has started", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const userJoin = await joinQuizRsvpAction(startedQuiz.team.id, regularUser.id, startedQuiz.id);
    const userDecline = await declineQuizRsvpAction(
      startedQuiz.team.id,
      regularUser.id,
      startedQuiz.id
    );

    expect(userJoin).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });
    expect(userDecline).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
    const adminJoin = await joinQuizRsvpAction(startedQuiz.team.id, adminUser.id, startedQuiz.id);
    const adminDecline = await declineQuizRsvpAction(
      startedQuiz.team.id,
      adminUser.id,
      startedQuiz.id
    );

    expect(adminJoin).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });
    expect(adminDecline).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });
  });

  // Review Focus #2: CANCELLED and ARCHIVED quizzes before startsAt
  it("enforces lockdown on CANCELLED and ARCHIVED future quizzes for USER and personal ADMIN RSVPs while allowing ADMIN management", async () => {
    for (const lockedQuiz of [cancelledFutureQuiz, archivedFutureQuiz]) {
      vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
      expect(await joinQuizRsvpAction(lockedQuiz.team.id, regularUser.id, lockedQuiz.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_RSVP_ERROR,
      });
      expect(await setRegisteredAction(lockedQuiz.team.id, regularUser.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_MUTATION_ERROR,
      });
      expect(await toggleFeePaidAction(lockedQuiz.team.id, regularUser.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_MUTATION_ERROR,
      });
      expect(await addGuestAction(lockedQuiz.team.id, "Gast")).toEqual({
        success: false,
        error: QUIZ_LOCKED_MUTATION_ERROR,
      });

      vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
      expect(await joinQuizRsvpAction(lockedQuiz.team.id, adminUser.id, lockedQuiz.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_RSVP_ERROR,
      });
      expect(await setRegisteredAction(lockedQuiz.team.id, adminUser.id)).toEqual({
        success: true,
      });
      expect(
        await adminOverrideAttendAction(lockedQuiz.team.id, regularUser.id, adminUser.id)
      ).toEqual({
        success: true,
      });
    }
  });

  // Review Focus #4: Non-admin guest removal blocked on both active and reserve entries when locked
  it("blocks non-admin inviter from removing active or reserve guests once quiz has started", async () => {
    const activeGuest = await prisma.rsvp.create({
      data: {
        teamId: startedQuiz.team.id,
        guestName: "ActiveGast",
        invitedById: regularUser.id,
        status: "ATTENDING",
        queuedSince: new Date(1000),
      },
    });
    const reserveGuest = await prisma.rsvp.create({
      data: {
        teamId: startedQuiz.team.id,
        guestName: "ReserveGast",
        invitedById: regularUser.id,
        status: "ATTENDING",
        queuedSince: new Date(2000),
      },
    });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    expect(await removeGuestAction(activeGuest.id, startedQuiz.team.id)).toEqual({
      success: false,
      error: QUIZ_LOCKED_MUTATION_ERROR,
    });
    expect(await removeGuestAction(reserveGuest.id, startedQuiz.team.id)).toEqual({
      success: false,
      error: QUIZ_LOCKED_MUTATION_ERROR,
    });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
    expect(await removeGuestAction(reserveGuest.id, startedQuiz.team.id)).toEqual({
      success: true,
    });
  });

  it("allows personal RSVP on an OPEN future quiz and uses sessionMember.id", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const res = await joinQuizRsvpAction(futureQuiz.team.id, "spoofed-id", futureQuiz.id);
    expect(res.success).toBe(true);

    const saved = await prisma.rsvp.findUnique({
      where: { teamId_memberId: { teamId: futureQuiz.team.id, memberId: regularUser.id } },
    });
    expect(saved?.status).toBe("ATTENDING");
  });

  it("blocks registration and payment toggles for regular USER after startsAt, but allows ADMIN", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const userReg = await setRegisteredAction(startedQuiz.team.id, regularUser.id);
    const userPay = await toggleFeePaidAction(startedQuiz.team.id, regularUser.id);
    expect(userReg).toEqual({ success: false, error: QUIZ_LOCKED_MUTATION_ERROR });
    expect(userPay).toEqual({ success: false, error: QUIZ_LOCKED_MUTATION_ERROR });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
    const adminReg = await setRegisteredAction(startedQuiz.team.id, adminUser.id);
    const adminPay = await toggleFeePaidAction(startedQuiz.team.id, adminUser.id);
    expect(adminReg).toEqual({ success: true });
    expect(adminPay).toEqual({ success: true, isPaid: true });
  });

  it("allows regular USER to toggle registration and payment before startsAt", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const userReg = await setRegisteredAction(futureQuiz.team.id, regularUser.id);
    const userPay = await toggleFeePaidAction(futureQuiz.team.id, regularUser.id);
    expect(userReg).toEqual({ success: true });
    expect(userPay).toEqual({ success: true, isPaid: true });
  });

  it("keeps admin lineup overrides and reorder executable after startsAt", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);

    const attendRes = await adminOverrideAttendAction(
      startedQuiz.team.id,
      regularUser.id,
      adminUser.id
    );
    const attendAdminRes = await adminOverrideAttendAction(
      startedQuiz.team.id,
      adminUser.id,
      adminUser.id
    );
    const reorderRes = await adminReorderRsvpAction(startedQuiz.team.id, 0, 1);
    const declineRes = await adminOverrideDeclineAction(
      startedQuiz.team.id,
      regularUser.id,
      adminUser.id
    );

    expect(attendRes.success).toBe(true);
    expect(attendAdminRes.success).toBe(true);
    expect(reorderRes.success).toBe(true);
    expect(declineRes.success).toBe(true);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/actions/quizLockEnforcement.test.ts`
Expected: FAIL (unauthenticated and locked actions currently succeed instead of returning errors).

- [x] **Step 3: Enforce lockdown in `src/services/rsvpService.ts`, `src/services/registrationService.ts`, and `src/services/paymentService.ts`**

1. In `src/services/rsvpService.ts` (`setRsvp`):
   - Inside `prisma.$transaction(async (tx) => { ... })`, immediately after `SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`, query:
     ```ts
     const teamWithQuiz = await tx.team.findUniqueOrThrow({
       where: { id: teamId },
       select: {
         quizId: true,
         quiz: { select: { startsAt: true, status: true } },
       },
     });
     if (isPersonalRsvpLocked(teamWithQuiz.quiz)) {
       throw new Error(QUIZ_LOCKED_RSVP_ERROR);
     }
     ```
   - Return `{ quizId: teamWithQuiz.quizId }` from the transaction (eliminating the redundant second `findUniqueOrThrow` at the end of `setRsvp`).
2. In `src/services/registrationService.ts` (`registerTeam`):
   - Accept `(teamId: string, memberId: string, actorRole: Role = "USER")`.
   - Inside `prisma.$transaction(async (tx) => { ... })`, call `tx.team.findUniqueOrThrow({ where: { id: teamId }, select: { quiz: { select: { startsAt: true, status: true } } } })` and throw `new Error(QUIZ_LOCKED_MUTATION_ERROR)` if `isQuizLockedForUser(existingTeam.quiz, actorRole)` is `true`, before updating `registeredAt` / `registeredById`.
3. In `src/services/paymentService.ts` (`toggleFeePayment`):
   - Keep the return type strictly `Promise<boolean>` (preserving compatibility with `tests/e2e/acceptance.test.ts`).
   - Accept `(teamId: string, memberId: string, actorRole: Role = "USER")`.
   - Query `team` with `select: { paidAt: true, quiz: { select: { startsAt: true, status: true } } }`.
   - Throw `new Error(QUIZ_LOCKED_MUTATION_ERROR)` if `isQuizLockedForUser(team.quiz, actorRole)` is `true`.

- [x] **Step 4: Enforce session auth, lockdown, and non-fatal revalidation in `src/actions/rsvpActions.ts`, `src/actions/registrationActions.ts`, and `src/actions/guestActions.ts`**

1. In `src/actions/rsvpActions.ts` (`joinQuizRsvpAction` and `declineQuizRsvpAction`):
   - Call `const sessionMember = await getSessionMember(); if (!sessionMember) return { success: false, error: "Niet ingelogd" };`.
   - Use `sessionMember.id` as the authoritative `memberId` passed to `setRsvp(teamId, sessionMember.id, ...)` and `getQuizRatingSummary(quizId, sessionMember.id)`.
   - Wrap `revalidatePath` calls inside `try { ... } catch {}`.
2. In `src/actions/registrationActions.ts` (`setRegisteredAction` and `toggleFeePaidAction`):
   - Call `const sessionMember = await getSessionMember(); if (!sessionMember) return { success: false, error: "Niet ingelogd" };`.
   - Pass `sessionMember.id` and `sessionMember.role` to `registerTeam` / `toggleFeePayment`.
   - Lookup `quizId` via `prisma.team.findUnique({ where: { id: teamId }, select: { quizId: true } })` inside the action and revalidate `/quizzes` and `/quizzes/${team.quizId}` inside `try { ... } catch {}`.
3. In `src/actions/guestActions.ts`:
   - Replace the inline `const isStarted = new Date(...).getTime() <= Date.now()` checks in `addGuestAction` (using `team.quiz`) and `removeGuestAction` (using `rsvp.team.quiz`) with `if (isQuizLockedForUser(..., sessionMember.role))` returning `{ success: false, error: QUIZ_LOCKED_MUTATION_ERROR }`.
   - Wrap `revalidatePath` calls in `try { ... } catch {}`.

- [x] **Step 5: Update existing concluded-quiz tests (`tests/services/ratingService.test.ts` and `tests/actions/rsvpRatingSync.test.ts`) to match the lockdown invariant**

1. In `tests/services/ratingService.test.ts`:
   - Replace `setRsvp(quiz.team!.id, playerId, "ATTENDING")` on already-concluded/cancelled quizzes (lines 34-35, 95, 120-121, 147, 185, 206) with `adminOverrideAttend(quiz.team!.id, playerId, creator.id)` (line 73 uses a future quiz and stays `setRsvp`).
2. In `tests/actions/rsvpRatingSync.test.ts`:
   - Mock `auth.getSessionMember` (`import * as auth from "../../src/lib/auth"`) and create `creator` with `role: "ADMIN"`.
   - Seed initial attendance via `adminOverrideAttend(quiz.team!.id, p1.id, creator.id)` and `adminOverrideAttend(quiz.team!.id, p2.id, creator.id)` (or `prisma.rsvp.create`).
   - Mock `getSessionMember` as `p2` and verify `declineQuizRsvpAction` is blocked by start-time lockdown on the concluded quiz (`success: false`, `QUIZ_LOCKED_RSVP_ERROR`).
   - Mock `getSessionMember` as `creator` (`ADMIN`) and verify `adminOverrideDeclineAction` + `getQuizRatingSummary(quiz.id, p2.id)` excludes Jef's 5-star vote (`average: 4`, `count: 1`, `userScore: null`), and `adminOverrideAttendAction` + `getQuizRatingSummary(quiz.id, p2.id)` restores Jef's 5-star vote (`average: 4.5`, `count: 2`, `userScore: 5`).

- [x] **Step 6: Run all service and action tests to verify they pass**

Run: `npx vitest run tests/actions/quizLockEnforcement.test.ts tests/actions/guestActions.test.ts tests/actions/rsvpRatingSync.test.ts tests/services/ratingService.test.ts tests/services/domain-events-emission.test.ts tests/e2e/acceptance.test.ts`
Expected: PASS across all test suites.

---

### Task 3: Presentation & UI Lockdown (`RsvpControl`, `TeamLineup`, `ActionToolbar`, `QuizDetailClient`)

**Files:**

- Modify: `src/components/RsvpControl.tsx:1-55`
- Modify: `src/components/TeamLineup.tsx:260-328`
- Modify: `src/components/ActionToolbar.tsx:13-210`
- Modify: `src/components/QuizDetailClient.tsx:82-345`
- Create: `tests/components/QuizStartLockdownUI.test.tsx`

**Interfaces:**

- Consumes from `@/lib/quizLock`: `isPersonalRsvpLocked`, `isQuizLockedForUser`
- Modifies `RsvpControlProps` in `src/components/RsvpControl.tsx`: adds optional `isLocked?: boolean` and `isAdmin?: boolean`
- Modifies `ActionToolbarProps` in `src/components/ActionToolbar.tsx`: adds optional `isLocked?: boolean`

- [x] **Step 1: Write the failing UI markup tests in `tests/components/QuizStartLockdownUI.test.tsx`**

Create `tests/components/QuizStartLockdownUI.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { CapabilitiesProvider } from "../../src/features/capabilities";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const caps = {
  vision: false,
  icalExport: true,
  whatsappShare: true,
  emailRegistration: true,
  sharedGoogleCalendar: false,
};

function makeQuiz(overrides: Partial<any> = {}) {
  return {
    id: "quiz-1",
    title: "Lockdown Quiz",
    startsAt: new Date(Date.now() - 3600000), // started 1h ago
    durationMinutes: 180,
    location: "Gent",
    status: "OPEN",
    entryFee: null,
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 2,
      registeredAt: null,
      paidAt: null,
      rsvps: [
        {
          id: "rsvp-1",
          memberId: "user-1",
          status: "ATTENDING",
          queuedSince: new Date(1000),
          member: { id: "user-1", name: "Alice" },
        },
        {
          id: "rsvp-guest-active",
          memberId: null,
          guestName: "ActiveGast",
          invitedById: "user-1",
          invitedBy: { id: "user-1", name: "Alice" },
          status: "ATTENDING",
          queuedSince: new Date(1500),
        },
        {
          id: "rsvp-guest-reserve",
          memberId: null,
          guestName: "ReserveGast",
          invitedById: "user-1",
          invitedBy: { id: "user-1", name: "Alice" },
          status: "ATTENDING",
          queuedSince: new Date(2000),
        },
      ],
    },
    ...overrides,
  };
}

describe("Quiz Start Lockdown UI", () => {
  // Review Focus #4: Active + reserve guest Verwijderen hidden + ActionToolbar locked + RSVP hidden for USER
  it("hides personal RSVP buttons, guest removal (both active and reserve), and registration/payment toggles for USER on started quiz while keeping WhatsApp & Calendar", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={makeQuiz()}
          currentMemberId="user-1"
          currentMemberName="Alice"
          isAdmin={false}
        />
      </CapabilitiesProvider>
    );

    expect(html).not.toContain("Ik doe mee");
    expect(html).not.toContain("Kan niet");
    expect(html).toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain(
      "De inschrijvingen zijn gesloten. Wijzigingen kunnen enkel door een beheerder worden doorgevoerd."
    );
    expect(html).not.toContain("+ Gast toevoegen");
    expect(html).not.toContain("Verwijderen");
    expect(html).toContain("Status vergrendeld na starttijd");
    expect(html).not.toContain("Mail verzonden? Bevestig registratie");
    expect(html).not.toContain("Schrijf Ploeg In (Open Mail)");
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Niet betaald/);
    expect(html).toContain("Niet betaald");
    expect(html).toContain("WhatsApp");
    expect(html).toContain("In Agenda");
  });

  // Review Focus #3: Player Dual-Identity for ADMIN on started quiz
  it("hides personal RSVP buttons for ADMIN on started quiz with admin override banner, while keeping admin controls active", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={makeQuiz()}
          currentMemberId="admin-1"
          currentMemberName="Admin Marc"
          isAdmin={true}
          allMembers={[{ id: "user-2", name: "Bob" }]}
        />
      </CapabilitiesProvider>
    );

    expect(html).not.toContain("Ik doe mee");
    expect(html).not.toContain("Kan niet");
    expect(html).toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain(
      "Inschrijvingen gesloten. Als beheerder kun je hieronder spelers handmatig aanpassen of wisselen."
    );
    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("+ Teamlid toevoegen");
    expect(html).toContain("Afzeggen");
    expect(html).toContain("Mail verzonden? Bevestig registratie");
    expect(html).toMatch(
      /<button[^>]*>(?:(?!<\/button>)[\s\S])*Niet betaald(?:(?!<\/button>)[\s\S])*<\/button>/
    );
  });

  it("renders interactive personal RSVP buttons for USER on a future OPEN quiz", () => {
    const futureQuiz = makeQuiz({ startsAt: new Date(Date.now() + 86400000) });
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={futureQuiz}
          currentMemberId="user-1"
          currentMemberName="Alice"
          isAdmin={false}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Ik doe mee");
    expect(html).toContain("Kan niet");
    expect(html).not.toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("Verwijderen");
  });

  // Review Focus #5: Post-quiz rating widget remains active when concluded
  it("keeps QuizRatingWidget interactive for eligible players on a concluded locked quiz", () => {
    const concludedQuiz = makeQuiz({ startsAt: new Date(Date.now() - 86400000) });
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={concludedQuiz}
          currentMemberId="user-1"
          currentMemberName="Alice"
          isAdmin={false}
          initialRatingSummary={{ average: 4, count: 1, totalEligible: 1, userScore: 4 }}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain("Hoe was deze quiz?");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/QuizStartLockdownUI.test.tsx`
Expected: FAIL (`"Ik doe mee"` still rendered on started quiz, `"Verwijderen"` still rendered on reserve guest, `"Mail verzonden? Bevestig registratie"` still rendered when locked).

- [x] **Step 3: Implement UI lockdown in `RsvpControl.tsx`, `TeamLineup.tsx`, `ActionToolbar.tsx`, and `QuizDetailClient.tsx`**

1. **`src/components/RsvpControl.tsx`:**
   - Add `isLocked?: boolean` and `isAdmin?: boolean` to `RsvpControlProps` (both defaulting to `false`).
   - Show `"Afgemeld"` badge if `currentStatus === "DECLINED"` (optional/helpful when buttons are hidden) alongside existing `"In de ploeg"` / `"Reserve #..."` badge.
   - When `isLocked` is `true`, replace the interactive button `div` with a status banner displaying `Lock` icon from `lucide-react`:
     - Heading: `Quiz gestart — opstelling definitief`
     - Subtext: if `isAdmin`, `"Inschrijvingen gesloten. Als beheerder kun je hieronder spelers handmatig aanpassen of wisselen."`, else `"De inschrijvingen zijn gesloten. Wijzigingen kunnen enkel door een beheerder worden doorgevoerd."`
2. **`src/components/TeamLineup.tsx`:**
   - On line 268 (Reserve List `canRemoveGuest`), match the active lineup check by adding `!isLocked && Boolean(...)`:
     ```ts
     const canRemoveGuest =
       member.isGuest &&
       (isAdmin ||
         (!isLocked && Boolean(currentMemberId && member.invitedById === currentMemberId)));
     ```
3. **`src/components/ActionToolbar.tsx`:**
   - Add `isLocked?: boolean` (default `false`) to `ActionToolbarProps`.
   - When `isLocked` is `true`:
     - Replace the interactive registration action container (`mailtoUrl` link, `"Bevestig registratie"` / `"Inschrijving heropenen / annuleren"` toggle button, and `"Kopieer mailtekst"` button) with a read-only notice: `"🔒 Status vergrendeld na starttijd"`.
     - Render the payment tile as a non-interactive read-only `<div>` (no `<button>`, no `onClick`, no hover styles) showing `isPaid ? "Betaald ✓" : "Niet betaald"`.
     - Keep WhatsApp Share and Google Calendar / `.ics` links completely active and clickable.
4. **`src/components/QuizDetailClient.tsx`:**
   - Import `isPersonalRsvpLocked`, `isQuizLockedForUser` from `@/lib/quizLock`.
   - Replace inline `isLockedForUser` calculation with:
     ```ts
     const isPersonalLocked = isPersonalRsvpLocked(quiz);
     const isLockedForUser = isQuizLockedForUser(quiz, isAdmin ? "ADMIN" : "USER");
     ```
   - Pass `isLocked={isPersonalLocked}` and `isAdmin={isAdmin}` to `<RsvpControl />`.
   - Pass `isLocked={isLockedForUser}` to `<ActionToolbar />`.
   - Make `handleRsvpChange`, `confirmAdminOverrideDecline`, `handleReorder`, `handleRegisterToggle`, and `handlePaymentToggle` error-safe: await the Server Action result first, dispatch/toggle local state ONLY when `res.success === true`, and call `setErrorMessage(res.error || ...)` when `!res.success` (catching thrown errors as well).

- [x] **Step 4: Run component tests to verify they pass**

Run: `npx vitest run tests/components/QuizStartLockdownUI.test.tsx tests/components/TeamLineupGuests.test.tsx tests/ui/actionToolbarRegistration.test.tsx tests/ui/quizRatingIntegration.test.tsx tests/components/QuizDetailDeclined.test.tsx tests/components/QuizDetailEnroll.test.tsx`
Expected: PASS across all component tests.

---

### Task 4: Documentation Sync & Full Verification Gate

**Files:**

- Modify: `docs/architecture/roles-and-permissions.md:54-67`
- Modify: `docs/roadmap.md:138-147`

- [x] **Step 1: Update `docs/architecture/roles-and-permissions.md` permission matrix**

Update the matrix rows to accurately reflect the spec:

- `Self RSVP (Attend / Decline)`: `USER` = `✅ _(pre-start)_`, `ADMIN` = `✅ _(pre-start)_` (personal RSVP bar freezes for _all_ members including admins once `startsAt` arrives, while admins retain `Enroll unresponded teammate` / `Reinstate` / `Override-decline` / `Reorder` at all times).
- `Mark team registered` and `Toggle entry fee payment`: `USER` = `✅ _(pre-start)_`, `ADMIN` = `✅`.
- Update Section 3.1 (`Start-Time Roster Lockdown`) to note personal RSVP freeze for all members + admin override retention.

- [x] **Step 2: Run full blocking quality pipeline (`npm run check:all`)**

Run: `npm run check:all`
Expected: Exit code `0` (`typecheck`, `test`, `lint`, `format:check`, `audit:check`, `scan:secrets`, `knip`, and `knip:prod` all PASS).

- [x] **Step 3: Execute `documenting-feature-release` closeout checklist (after user approves completion)**

Follow the project's `documenting-feature-release` skill for `CHANGELOG.md`, `docs/roadmap.md` archiving, and `docs/superpowers/feedback/` cleanup before declaring the feature shipped.

**Final Fresh-Context Review Notes (2026-11-22):**

- Approved (`0` Critical, `0` Important).
- Deferred Minors:
  1. `QuizDetailClient.tsx:71-72` pre-existing `team?.registeredAt !== null` vs `Boolean(team?.registeredAt)` null-safety.
  2. Copy specificity on pre-start `CANCELLED`/`ARCHIVED` quizzes (`"Quiz gestart — opstelling definitief"` matches spec).
  3. `guestActions.ts` checks `isQuizLockedForUser` prior to `addGuestRsvp`/`removeGuestRsvp` transaction rather than inside `FOR UPDATE`.
  4. Gate 6 (Git commit + annotated release tag) awaits explicit user consent.
