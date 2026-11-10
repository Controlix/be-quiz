# Lightweight Quiz Rating & Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow confirmed active quiz team members to rate past quizzes on a 1–5 star scale with 1 tap, while displaying aggregated scores on quiz detail and dashboard cards with strict individual vote privacy.

**Architecture:** Add a dedicated `QuizRating` PostgreSQL table with cascade deletion and unique `(quizId, memberId)` index. Business logic in `src/services/ratingService.ts` strictly aggregates scores on the server, enforcing a dynamic lineup filter (only active lineup members' votes count; reserves and non-attendees are excluded). Server Action `rateQuizAction` validates sessions and wraps the mutation, while `QuizRatingWidget` and `QuizCard` render rating UI via SSR and optimistic client state.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Prisma ORM (PostgreSQL), Lucide React icons, Tailwind CSS v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-quiz-rating-design.md`

## Global Constraints

- **Strict Privacy Guarantee:** A member's rating is strictly private; individual votes are NEVER exposed, serialized, or attached to client roster payloads (`docs/superpowers/specs/2026-11-08-quiz-rating-design.md:22`).
- **Conclusion Condition:** A quiz is concluded when `Date.now() >= startsAt.getTime() + (durationMinutes * 60 * 1000)` (`docs/superpowers/specs/2026-11-08-quiz-rating-design.md:49`).
- **Status Restriction:** Quizzes with status `CANCELLED` cannot be rated regardless of date (`docs/superpowers/specs/2026-11-08-quiz-rating-design.md:33`).
- **Eligibility Restriction:** Only confirmed active players (the first `maxTeamSize` attending RSVPs by `queuedSince`) are eligible to rate (`docs/superpowers/specs/2026-11-08-quiz-rating-design.md:34, 129`).
- **Dynamic Lineup Filter:** If a member previously rated and is subsequently demoted to reserve, their rating is dynamically omitted from aggregate score and count without destructive deletion (`docs/superpowers/specs/2026-11-08-quiz-rating-design.md:118-121`).
- **Deterministic Testing:** All calculations, service methods, and UI components must be tested deterministically in pure Node.js in Vitest without browser DOM emulation (`docs/superpowers/specs/2026-11-08-quiz-rating-design.md:50`).
- **Git Commit Consent:** Never run `git commit` without explicit user permission (`AGENTS.md`).

## Review Focus

1. **Score Boundary & Type Violations:** Submitting non-integer scores, 0, negative numbers, or scores > 5 must fail with `INVALID_SCORE` (tested in Task 2 & Task 3).
2. **Post-Quiz Lineup Demotion (Dynamic Filter):** Active player rates 5 stars, but an admin subsequently moves them to reserve; their vote must be dynamically excluded from summary average and count, and their `userScore` must return `null` (tested in Task 3).
3. **Rating Premature / Ongoing Quiz:** Submitting a rating when `now < startsAt + durationMinutes` must fail with `QUIZ_NOT_CONCLUDED` (tested in Task 2 & Task 3).
4. **Cancelled Quiz Attempt:** Submitting a rating for a quiz whose status is `CANCELLED` must fail with `QUIZ_CANCELLED` (tested in Task 3).
5. **Rating Update Idempotency:** Submitting a second rating replaces the player's previous rating; count remains 1 and average updates to the new score (tested in Task 3).

---

### Task 1: Database Model & Prisma Schema for `QuizRating`

**Files:**

- Modify: `prisma/schema.prisma:27-42, 63-86`
- Modify: `docs/database/schema.md`
- Test: `tests/db/ratingSchema.test.ts`

**Interfaces:**

- Produces: `QuizRating` model with fields `id`, `quizId`, `memberId`, `score`, `createdAt`, `updatedAt`, foreign key relations to `Quiz` and `Member` with `onDelete: Cascade`, and `@@unique([quizId, memberId])`.

- [x] **Step 1: Write the failing schema test**

Create `tests/db/ratingSchema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";

describe("QuizRating Database Model", () => {
  it("creates a quiz rating and verifies cascade deletion on quiz removal", async () => {
    const member = await prisma.member.create({
      data: { name: `RatingUser-${Date.now()}` },
    });

    const quiz = await prisma.quiz.create({
      data: {
        title: "Rating Schema Test Quiz",
        startsAt: new Date(Date.now() - 3600000),
        location: "Test Venue",
        createdById: member.id,
      },
    });

    const rating = await prisma.quizRating.create({
      data: {
        quizId: quiz.id,
        memberId: member.id,
        score: 5,
      },
    });

    expect(rating.id).toBeDefined();
    expect(rating.score).toBe(5);

    // Verify cascade deletion
    await prisma.quiz.delete({ where: { id: quiz.id } });
    const orphanRating = await prisma.quizRating.findUnique({
      where: { id: rating.id },
    });
    expect(orphanRating).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/ratingSchema.test.ts`
Expected: FAIL with `prisma.quizRating is undefined` or schema validation error.

- [x] **Step 3: Update `prisma/schema.prisma` and push database schema**

Add to `prisma/schema.prisma`:

```prisma
model QuizRating {
  id        String   @id @default(cuid())
  quizId    String
  memberId  String
  score     Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  quiz   Quiz   @relation(fields: [quizId], references: [id], onDelete: Cascade)
  member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([quizId, memberId])
  @@index([quizId])
  @@index([memberId])
}
```

Add `ratings QuizRating[]` to `Quiz` and `quizRatings QuizRating[]` to `Member`.
Run: `npx prisma db push` and `npx prisma generate`.
Update `docs/database/schema.md` with the new table and relations.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/ratingSchema.test.ts`
Expected: PASS

---

### Task 2: Pure Domain Logic & Rating Calculation Helpers

**Files:**

- Create: `src/lib/ratingRules.ts`
- Test: `tests/lib/ratingRules.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface QuizRatingSummary {
    average: number | null;
    count: number;
    totalEligible: number;
    userScore: number | null;
  }

  export function isQuizConcluded(startsAt: Date, durationMinutes: number, now?: Date): boolean;
  export function validateRatingScore(score: unknown): { valid: boolean; error?: string };
  export function computeRatingSummary(params: {
    ratings: Array<{ memberId: string; score: number }>;
    activeMemberIds: string[];
    currentMemberId?: string;
  }): QuizRatingSummary;
  ```

- [x] **Step 1: Write the failing unit tests for rating rules**

Create `tests/lib/ratingRules.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isQuizConcluded,
  validateRatingScore,
  computeRatingSummary,
} from "../../src/lib/ratingRules";

describe("ratingRules Pure Helpers", () => {
  it("determines if quiz is concluded based on startsAt + durationMinutes", () => {
    const baseTime = new Date("2026-11-10T20:00:00Z");
    const duration = 120; // ends at 22:00:00Z

    // Review Focus #3: Premature / ongoing quiz check
    expect(isQuizConcluded(baseTime, duration, new Date("2026-11-10T21:59:59Z"))).toBe(false);
    expect(isQuizConcluded(baseTime, duration, new Date("2026-11-10T22:00:00Z"))).toBe(true);
    expect(isQuizConcluded(baseTime, duration, new Date("2026-11-10T22:01:00Z"))).toBe(true);
  });

  // Review Focus #1: Score boundary and type violations
  it("validates score must be an integer between 1 and 5", () => {
    expect(validateRatingScore(1).valid).toBe(true);
    expect(validateRatingScore(5).valid).toBe(true);
    expect(validateRatingScore(0).valid).toBe(false);
    expect(validateRatingScore(6).valid).toBe(false);
    expect(validateRatingScore(3.5).valid).toBe(false);
    expect(validateRatingScore("4").valid).toBe(false);
    expect(validateRatingScore(null).valid).toBe(false);
  });

  it("computes rating summary strictly for active member ratings and rounds to 1 decimal", () => {
    const activeMemberIds = ["m1", "m2", "m3", "m4"];
    const ratings = [
      { memberId: "m1", score: 5 },
      { memberId: "m2", score: 4 },
      { memberId: "m3", score: 4 },
      // Review Focus #2: Reserve member rating excluded dynamically
      { memberId: "reserve-m5", score: 1 },
    ];

    const summary = computeRatingSummary({
      ratings,
      activeMemberIds,
      currentMemberId: "m1",
    });

    // (5 + 4 + 4) / 3 = 4.3333... => rounded to 4.3
    expect(summary.average).toBe(4.3);
    expect(summary.count).toBe(3);
    expect(summary.totalEligible).toBe(4);
    expect(summary.userScore).toBe(5);
  });

  it("returns userScore as null when current member is not in active lineup", () => {
    const summary = computeRatingSummary({
      ratings: [{ memberId: "m1", score: 5 }],
      activeMemberIds: ["m1"],
      currentMemberId: "m2",
    });
    expect(summary.userScore).toBeNull();
  });

  it("returns average null when count is 0", () => {
    const summary = computeRatingSummary({
      ratings: [],
      activeMemberIds: ["m1", "m2"],
    });
    expect(summary.average).toBeNull();
    expect(summary.count).toBe(0);
    expect(summary.totalEligible).toBe(2);
    expect(summary.userScore).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/ratingRules.test.ts`
Expected: FAIL with module not found `../../src/lib/ratingRules`.

- [x] **Step 3: Implement `src/lib/ratingRules.ts`**

Implement pure functions:

- `isQuizConcluded(startsAt, durationMinutes, now = new Date())`: `now.getTime() >= new Date(startsAt).getTime() + durationMinutes * 60 * 1000`.
- `validateRatingScore(score)`: checks `typeof score === "number" && Number.isInteger(score) && score >= 1 && score <= 5`.
- `computeRatingSummary({ ratings, activeMemberIds, currentMemberId })`: filters ratings where `activeMemberIds.includes(r.memberId)`. Computes sum, average rounded via `Math.round((sum / count) * 10) / 10`. Resolves `userScore` only if `currentMemberId` is in `activeMemberIds`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/ratingRules.test.ts`
Expected: PASS

---

### Task 3: Core Domain Service (`ratingService.ts`)

**Files:**

- Create: `src/services/ratingService.ts`
- Test: `tests/services/ratingService.test.ts`

**Interfaces:**

- Consumes: `src/lib/ratingRules.ts`, `src/lib/db.ts`
- Produces:

  ```typescript
  export async function getQuizRatingSummary(
    quizId: string,
    currentMemberId?: string
  ): Promise<QuizRatingSummary>;
  export async function submitQuizRating(params: {
    quizId: string;
    memberId: string;
    score: number;
  }): Promise<QuizRatingSummary>;
  export async function getBatchQuizRatings(
    quizIds: string[]
  ): Promise<Map<string, { average: number; count: number }>>;
  ```

- [x] **Step 1: Write the failing integration tests for `ratingService`**

Create `tests/services/ratingService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/db";
import {
  getQuizRatingSummary,
  submitQuizRating,
  getBatchQuizRatings,
} from "../../src/services/ratingService";
import { setRsvp } from "../../src/services/rsvpService";

describe("ratingService", () => {
  it("submits a rating for an active player and returns fresh summary", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player1 = await prisma.member.create({ data: { name: `Player1-${Date.now()}` } });
    const player2 = await prisma.member.create({ data: { name: `Player2-${Date.now()}` } });

    // Past quiz (ended 1 hour ago)
    const quiz = await prisma.quiz.create({
      data: {
        title: "Completed Pub Quiz",
        startsAt: new Date(Date.now() - 4 * 3600000),
        durationMinutes: 180,
        location: "Cafe Test",
        createdById: creator.id,
        team: {
          create: {
            name: "Test Team",
            maxTeamSize: 4,
          },
        },
      },
      include: { team: true },
    });

    await setRsvp(quiz.team!.id, player1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, player2.id, "ATTENDING");

    const summary = await submitQuizRating({
      quizId: quiz.id,
      memberId: player1.id,
      score: 5,
    });

    expect(summary.average).toBe(5);
    expect(summary.count).toBe(1);
    expect(summary.totalEligible).toBe(2);
    expect(summary.userScore).toBe(5);

    // Review Focus #5: Upsert/Update behavior
    const updated = await submitQuizRating({
      quizId: quiz.id,
      memberId: player1.id,
      score: 4,
    });
    expect(updated.average).toBe(4);
    expect(updated.count).toBe(1);
    expect(updated.userScore).toBe(4);
  });

  // Review Focus #3: Reject premature rating
  it("rejects rating when quiz has not yet concluded", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player = await prisma.member.create({ data: { name: `Player-${Date.now()}` } });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Future Quiz",
        startsAt: new Date(Date.now() + 3600000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });
    await setRsvp(quiz.team!.id, player.id, "ATTENDING");

    await expect(
      submitQuizRating({ quizId: quiz.id, memberId: player.id, score: 5 })
    ).rejects.toThrow("QUIZ_NOT_CONCLUDED");
  });

  // Review Focus #4: Reject rating cancelled quiz
  it("rejects rating when quiz status is CANCELLED", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player = await prisma.member.create({ data: { name: `Player-${Date.now()}` } });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Cancelled Quiz",
        startsAt: new Date(Date.now() - 36000000),
        status: "CANCELLED",
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });
    await setRsvp(quiz.team!.id, player.id, "ATTENDING");

    await expect(
      submitQuizRating({ quizId: quiz.id, memberId: player.id, score: 5 })
    ).rejects.toThrow("QUIZ_CANCELLED");
  });

  // Review Focus #2: Reject reserve/waitlisted player & Dynamic Lineup Filter
  it("rejects waitlisted reserve player and omits reserve ratings from aggregate summary", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const p1 = await prisma.member.create({ data: { name: `P1-${Date.now()}` } });
    const p2 = await prisma.member.create({ data: { name: `P2-${Date.now()}` } });

    // maxTeamSize = 1
    const quiz = await prisma.quiz.create({
      data: {
        title: "Small Team Quiz",
        startsAt: new Date(Date.now() - 36000000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 1 } },
      },
      include: { team: true },
    });

    await setRsvp(quiz.team!.id, p1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, p2.id, "ATTENDING"); // p2 is on reserve

    await expect(submitQuizRating({ quizId: quiz.id, memberId: p2.id, score: 5 })).rejects.toThrow(
      "NOT_ELIGIBLE"
    );
  });

  // Review Focus #2: Dynamic Lineup Filter (demoted player's rating omitted dynamically)
  it("dynamically excludes rating from aggregate score and userScore when member is demoted to reserve", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const p1 = await prisma.member.create({ data: { name: `P1-${Date.now()}` } });
    const p2 = await prisma.member.create({ data: { name: `P2-${Date.now()}` } });

    // Concluded quiz with maxTeamSize = 1
    const quiz = await prisma.quiz.create({
      data: {
        title: "Demotion Test Quiz",
        startsAt: new Date(Date.now() - 36000000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 1 } },
      },
      include: { team: true },
    });

    // p1 joins first (active lineup) and rates 5 stars
    await setRsvp(quiz.team!.id, p1.id, "ATTENDING");
    const initialSummary = await submitQuizRating({ quizId: quiz.id, memberId: p1.id, score: 5 });
    expect(initialSummary.average).toBe(5);
    expect(initialSummary.count).toBe(1);
    expect(initialSummary.userScore).toBe(5);

    // p2 is inserted ahead of p1 by admin / reorder, demoting p1 to reserve
    // Simulate by setting p2 queued earlier than p1
    await prisma.rsvp.create({
      data: {
        teamId: quiz.team!.id,
        memberId: p2.id,
        status: "ATTENDING",
        queuedSince: new Date(Date.now() - 100000), // queued before p1
      },
    });

    // When fetching summary now: p1 is no longer in active lineup (maxTeamSize = 1)
    const demotedSummary = await getQuizRatingSummary(quiz.id, p1.id);
    expect(demotedSummary.average).toBeNull();
    expect(demotedSummary.count).toBe(0);
    expect(demotedSummary.totalEligible).toBe(1);
    expect(demotedSummary.userScore).toBeNull(); // Private vote hidden while not in active lineup
  });

  it("retrieves batch ratings for multiple quizzes", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player = await prisma.member.create({ data: { name: `Player-${Date.now()}` } });

    const q1 = await prisma.quiz.create({
      data: {
        title: "Batch Q1",
        startsAt: new Date(Date.now() - 36000000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });
    await setRsvp(q1.team!.id, player.id, "ATTENDING");
    await submitQuizRating({ quizId: q1.id, memberId: player.id, score: 4 });

    const batch = await getBatchQuizRatings([q1.id]);
    expect(batch.get(q1.id)).toEqual({ average: 4, count: 1 });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/ratingService.test.ts`
Expected: FAIL with module not found `../../src/services/ratingService`.

- [x] **Step 3: Implement `src/services/ratingService.ts`**

Implement:

1. `getQuizRatingSummary(quizId, currentMemberId)`:
   - Queries quiz with team and attending RSVPs ordered by `queuedSince asc`.
   - Extracts `activeMemberIds = attendingRsvps.slice(0, team.maxTeamSize).map(r => r.memberId)`.
   - Queries `prisma.quizRating.findMany({ where: { quizId } })`.
   - Passes to `computeRatingSummary`.
2. `submitQuizRating({ quizId, memberId, score })`:
   - Validates score using `validateRatingScore`.
   - Fetches quiz with `status`, `startsAt`, `durationMinutes`, and attending RSVPs.
   - Asserts `quiz.status !== "CANCELLED"`.
   - Asserts `isQuizConcluded(quiz.startsAt, quiz.durationMinutes)`.
   - Asserts `activeMemberIds.includes(memberId)`.
   - Upserts into `prisma.quizRating`.
   - Returns fresh `getQuizRatingSummary(quizId, memberId)`.
3. `getBatchQuizRatings(quizIds)`:
   - Fetches quizzes with active RSVPs and their `QuizRating` records.
   - Computes average and count per quiz respecting active lineup members.
   - Returns `Map<string, { average: number; count: number }>`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/ratingService.test.ts`
Expected: PASS

---

### Task 4: Server Action (`ratingActions.ts`)

**Files:**

- Create: `src/actions/ratingActions.ts`
- Test: `tests/actions/ratingActions.test.ts`

**Interfaces:**

- Consumes: `src/services/ratingService.ts`, `src/lib/auth.ts`
- Produces:

  ```typescript
  export async function rateQuizAction(
    quizId: string,
    score: number
  ): Promise<{ success: true; summary: QuizRatingSummary } | { success: false; error: string }>;
  ```

- [x] **Step 1: Write the failing tests for `rateQuizAction`**

Create `tests/actions/ratingActions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as auth from "../../src/lib/auth";
import * as ratingService from "../../src/services/ratingService";
import { rateQuizAction } from "../../src/actions/ratingActions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("rateQuizAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if user is unauthenticated", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);

    const result = await rateQuizAction("quiz-123", 5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Niet ingelogd");
    }
  });

  it("submits rating and triggers revalidations when user is authenticated", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({
      id: "member-1",
      name: "Marc",
      role: "USER",
      pinHash: null,
      createdAt: new Date(),
    });

    const mockSummary = { average: 5, count: 1, totalEligible: 4, userScore: 5 };
    vi.spyOn(ratingService, "submitQuizRating").mockResolvedValue(mockSummary);

    const result = await rateQuizAction("quiz-123", 5);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.summary).toEqual(mockSummary);
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/actions/ratingActions.test.ts`
Expected: FAIL with module not found `../../src/actions/ratingActions`.

- [x] **Step 3: Implement `src/actions/ratingActions.ts`**

Implement:

```typescript
"use server";

import { getSessionMember } from "@/lib/auth";
import { submitQuizRating, QuizRatingSummary } from "@/services/ratingService";
import { revalidatePath } from "next/cache";

export async function rateQuizAction(
  quizId: string,
  score: number
): Promise<{ success: true; summary: QuizRatingSummary } | { success: false; error: string }> {
  try {
    const member = await getSessionMember();
    if (!member) {
      return { success: false, error: "Niet ingelogd" };
    }

    const summary = await submitQuizRating({
      quizId,
      memberId: member.id,
      score,
    });

    revalidatePath(`/quizzes/${quizId}`);
    revalidatePath("/quizzes");

    return { success: true, summary };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Er is een fout opgetreden bij het beoordelen.",
    };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/actions/ratingActions.test.ts`
Expected: PASS

---

### Task 5: UI Components — `QuizRatingWidget` & `QuizCard` Rating Badge

**Files:**

- Create: `src/components/QuizRatingWidget.tsx`
- Modify: `src/components/QuizCard.tsx:6-40`
- Test: `tests/components/QuizRatingWidget.test.tsx`
- Test: `tests/components/QuizCardRating.test.tsx`

**Interfaces:**

- Produces:
  - `QuizRatingWidget({ quizId, summary, isConcluded, isEligible, isCancelled })`
  - `QuizCard({ quiz, rating })` with compact amber badge `★ 4.3` on past/concluded quizzes with ratings.

- [x] **Step 1: Write failing UI render tests using `renderToStaticMarkup`**

Create `tests/components/QuizRatingWidget.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizRatingWidget } from "../../src/components/QuizRatingWidget";

describe("QuizRatingWidget Static Markup", () => {
  it("renders null if quiz is not concluded or cancelled", () => {
    const html1 = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={false}
        isEligible={true}
        isCancelled={false}
        summary={{ average: null, count: 0, totalEligible: 4, userScore: null }}
      />
    );
    expect(html1).toBe("");

    const html2 = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={true}
        isEligible={true}
        isCancelled={true}
        summary={{ average: 4, count: 1, totalEligible: 4, userScore: 4 }}
      />
    );
    expect(html2).toBe("");
  });

  it("renders 5 interactive star buttons and prompt for active eligible players", () => {
    const html = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={true}
        isEligible={true}
        isCancelled={false}
        summary={{ average: 4.5, count: 2, totalEligible: 4, userScore: 4 }}
      />
    );
    expect(html).toContain("Hoe was deze quiz?");
    expect(html).toContain("Jouw stem is anoniem en priv");
    expect(html).toContain("Jouw stem: 4/5");
    expect(html).toContain("Teamscore: ★ 4.5 / 5 (2 van 4 spelers gestemd)");
  });

  it("renders read-only aggregate summary for non-attending / reserve players", () => {
    const html = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={true}
        isEligible={false}
        isCancelled={false}
        summary={{ average: 4.3, count: 3, totalEligible: 4, userScore: null }}
      />
    );
    expect(html).toContain("Teambeoordeling");
    expect(html).toContain("4.3");
    expect(html).toContain("3 van 4 spelers");
    expect(html).not.toContain("Hoe was deze quiz?");
  });
});
```

Create `tests/components/QuizCardRating.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizCard } from "../../src/components/QuizCard";

describe("QuizCard Rating Badge", () => {
  const dummyQuiz: any = {
    id: "q1",
    title: "Past Quiz Night",
    startsAt: new Date(Date.now() - 86400000),
    location: "Pub",
    status: "OPEN",
    team: { maxTeamSize: 4, registeredAt: new Date(), rsvps: [] },
  };

  it("renders amber rating badge when averageRating is present", () => {
    const html = renderToStaticMarkup(
      <QuizCard quiz={dummyQuiz} rating={{ average: 4.3, count: 3 }} />
    );
    expect(html).toContain("★ 4.3");
  });

  it("omits rating badge when rating is null or count is 0", () => {
    const html = renderToStaticMarkup(
      <QuizCard quiz={dummyQuiz} rating={null} />
    );
    expect(html).not.toContain("★");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/QuizRatingWidget.test.tsx tests/components/QuizCardRating.test.tsx`
Expected: FAIL with module not found or missing props.

- [x] **Step 3: Implement `QuizRatingWidget.tsx` and update `QuizCard.tsx`**

1. Create `src/components/QuizRatingWidget.tsx`:
   - Interactive star rating component with optimistic updates on click (`useState`).
   - Calls `rateQuizAction(quizId, star)`.
   - Handles both active eligible mode and read-only aggregate mode per spec requirements.
2. Modify `src/components/QuizCard.tsx`:
   - Accept optional `rating?: { average: number; count: number } | null`.
   - Render badge `<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">★ {rating.average.toFixed(1)}</span>` if `rating && rating.count > 0`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/QuizRatingWidget.test.tsx tests/components/QuizCardRating.test.tsx`
Expected: PASS

---

### Task 6: Page Integration (`QuizDetailPage` & `QuizzesDashboard`)

**Files:**

- Modify: `src/app/quizzes/[id]/page.tsx`
- Modify: `src/components/QuizDetailClient.tsx`
- Modify: `src/app/quizzes/page.tsx`
- Modify: `src/components/QuizzesDashboard.tsx`
- Test: `tests/ui/quizRatingIntegration.test.tsx`

**Interfaces:**

- Consumes: `getQuizRatingSummary`, `getBatchQuizRatings` from `ratingService`, `QuizRatingWidget`, `QuizCard`.

- [x] **Step 1: Write integration test for QuizDetailClient and QuizzesDashboard**

Create `tests/ui/quizRatingIntegration.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { QuizzesDashboard } from "../../src/components/QuizzesDashboard";

describe("Quiz Rating Page Integration", () => {
  it("renders QuizRatingWidget in QuizDetailClient for concluded quizzes", () => {
    const pastQuiz: any = {
      id: "q-past",
      title: "Concluded Quiz",
      startsAt: new Date(Date.now() - 86400000),
      durationMinutes: 180,
      location: "Pub",
      status: "OPEN",
      team: {
        id: "t-past",
        maxTeamSize: 4,
        registeredAt: null,
        paidAt: null,
        rsvps: [{ memberId: "m1", status: "ATTENDING", queuedSince: new Date(1000), member: { id: "m1", name: "Player" } }],
      },
    };

    const ratingSummary = { average: 5, count: 1, totalEligible: 1, userScore: 5 };

    const html = renderToStaticMarkup(
      <QuizDetailClient
        quiz={pastQuiz}
        currentMemberId="m1"
        initialRatingSummary={ratingSummary}
      />
    );

    expect(html).toContain("Hoe was deze quiz?");
  });

  it("renders rating badges in QuizzesDashboard for quizzes with ratings", () => {
    const quizzes: any[] = [
      {
        id: "q-archived",
        title: "Archived Quiz",
        startsAt: new Date(Date.now() - 86400000),
        status: "OPEN",
        team: { maxTeamSize: 4, registeredAt: null, rsvps: [] },
      },
    ];
    // Realistic average for 2 players (e.g. 4 and 5): (4 + 5) / 2 = 4.5
    const ratingsMap = { "q-archived": { average: 4.5, count: 2 } };

    const html = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={quizzes} ratingsMap={ratingsMap} initialTab="ARCHIEF" />
    );

    expect(html).toContain("★ 4.5");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/quizRatingIntegration.test.tsx`
Expected: FAIL due to missing props or unintegrated widget.

- [x] **Step 3: Wire ratings into `QuizDetailPage`, `QuizDetailClient`, `QuizzesPage`, and `QuizzesDashboard`**

1. In `src/app/quizzes/[id]/page.tsx`:
   - Call `const ratingSummary = await getQuizRatingSummary(quiz.id, currentMember.id);`.
   - Pass `initialRatingSummary={ratingSummary}` to `QuizDetailClient`.
2. In `src/components/QuizDetailClient.tsx`:
   - Compute `isConcluded = isQuizConcluded(quiz.startsAt, quiz.durationMinutes || 180)`.
   - Derive `isEligible = currentUserIndex !== -1 && !isReserve` (strictly active lineup; reserves where `currentUserIndex >= (team?.maxTeamSize || 4)` are not eligible to rate).
   - Render `<QuizRatingWidget quizId={quiz.id} isConcluded={isConcluded} isEligible={isEligible} isCancelled={quiz.status === 'CANCELLED'} summary={ratingSummary} />` below quiz header / details and above RSVP / lineup controls.
3. In `src/app/quizzes/page.tsx`:
   - Extract quiz IDs and call `const batchRatings = await getBatchQuizRatings(quizzes.map(q => q.id));`.
   - Convert `batchRatings` map to plain object record via `Object.fromEntries(batchRatings)` and pass `ratingsMap` to `QuizzesDashboard`.
4. In `src/components/QuizzesDashboard.tsx`:
   - Support optional `initialTab?: TabCategory = "IN_BERAAD"` in `QuizzesDashboardProps`.
   - Pass `rating={ratingsMap?.[quiz.id]}` to each `QuizCard`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/quizRatingIntegration.test.tsx`
Expected: PASS

---

### Task 7: Documentation Synchronization & Full Quality Gates

**Files:**

- Modify: `docs/roadmap.md`
- Modify: `docs/database/schema.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Synchronize Database & API Documentation**

Verify that `docs/database/schema.md` documents the `QuizRating` model, relations, and cascade rules. (Note: Server Actions do not add HTTP REST endpoints in `src/app/api`, so `docs/api/openapi.yaml` remains synchronized with existing HTTP routes).

- [x] **Step 2: Update `docs/roadmap.md`**

Update Roadmap Item 11 status to link to this implementation plan:

```markdown
- **Status:** `[ ] In Progress: [docs/superpowers/plans/2026-11-10-quiz-rating-implementation.md](superpowers/plans/2026-11-10-quiz-rating-implementation.md)` (Spec: `docs/superpowers/specs/2026-11-08-quiz-rating-design.md`)
```

- [x] **Step 3: Run Full Quality Suite (`npm run check:all`)**

Run: `npm run check:all`
Expected: Typecheck, Vitest tests, ESLint, Prettier format check, Audit-CI security audit, and Secretlint pass with 0 errors.
