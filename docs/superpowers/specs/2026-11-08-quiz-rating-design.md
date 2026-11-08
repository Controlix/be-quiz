# Design Specification: Lightweight Quiz Rating & Display

**Date:** 2026-11-08  
**Topic:** Post-Quiz Evaluation — 1-to-5 Star Rating & Dashboard/Detail Display (Roadmap Item 11)  
**Status:** Approved

---

## 1. Intent & The Why

Pub quiz nights are recurring social events. After participating in a quiz, team members naturally have an impression of how enjoyable, well-organized, or balanced the event was.

Currently, the app tracks quizzes up to their event date and lineup, but has zero post-event feedback or evaluation mechanism. Adding a zero-overhead, 1-tap rating (1 to 5 stars) allows participating teammates to log their impression immediately after a quiz concludes. Recording this now establishes an authentic historical record of team experiences for past quizzes.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals

- **Zero Overhead 1-Tap Rating:** Confirmed active players can rate a completed quiz on a 1–5 star scale with a single tap.
- **Strict Privacy Guarantee:** A member's rating is strictly private. Teammates and admins only see the collective average score and count; individual votes are never exposed or listed.
- **Forgiving & Editable:** Attending active players can re-tap/adjust their rating at any time after the quiz concludes to correct accidental misclicks or update their assessment.
- **Two-Sided Visibility:**
  - **Quiz Detail View:** If the quiz has ended, active lineup members see the interactive rating widget with their private vote and team average. Non-attending members, waitlisted reserves, and visitors see only the aggregate team average score and count.
  - **Dashboard Cards (Past Quizzes):** Completed quiz cards display a compact rating badge (e.g., `★ 4.3`) if at least one rating has been submitted.
- **Single Source of Truth & Clean Isolation:** Ratings are persisted in a dedicated PostgreSQL table via Prisma and aggregated server-side, preventing state drift.

### 2.2 Non-Goals

- **Detailed Questionnaires or Written Reviews:** No long-form text comments, category breakdowns (e.g. food/audio/difficulty), or questionnaires. Strictly a 1–5 score.
- **Ratings for Future / Open Quizzes:** Quizzes that have not yet ended (`now < startsAt + durationMinutes`) cannot be rated.
- **Ratings for Cancelled Quizzes:** Quizzes with status `CANCELLED` cannot be rated regardless of date.
- **Waitlisted Reserves Voting:** Members in reserve/waitlist queue (`queuedSince` placing them outside `maxTeamSize`) did not participate and cannot rate.
- **Smart Historical Suggestions on Entry (Item 12):** Checking previous editions during quiz creation or flyer OCR is explicitly deferred to future backlog item 12.

### 2.3 Anti-Goals

- **Exposing Individual Votes:** No member-by-member rating lists, breakdown charts that reveal individual identities, or leaderboard comparisons between players.
- **Coupling Rating into RSVP Payloads:** Never attach ratings to the `Rsvp` array sent to the browser for lineup rendering, which would create a score leak vulnerability.

---

## 3. Constraints & Architectural Invariants

1. **Service Layer Isolation:** All business logic, eligibility checks, and database mutations live in `src/services/ratingService.ts`. Server Actions act only as controller wrappers.
2. **Core Domain Independence:** Ratings require only PostgreSQL and Next.js; no third-party services or external APIs.
3. **Database Integrity:** Foreign keys use `Cascade` deletion when a `Quiz` or `Member` is removed. Unique constraint `@@unique([quizId, memberId])` prevents duplicate entries.
4. **Time Zone Aware Conclusion Check:** A quiz is considered concluded when `now() >= startsAt + (durationMinutes * 60 * 1000)`.
5. **Deterministic Testing:** All rating rules, calculations, and mutations must be verified via Node-based Vitest tests without DOM emulation.

---

## 4. Evaluated Approaches

### Approach 1: Dedicated `QuizRating` Table with Server-Aggregated Summary (Selected)

- **Architecture:** Add `QuizRating` model (`quizId`, `memberId`, `score: 1..5`, timestamps) with unique index `[quizId, memberId]`.
- **Summary Contract:** Service returns `{ average: number | null, count: number, userScore: number | null, totalEligible: number }`.
- **Why Chosen:** Guaranteed privacy (individual votes never serialized to client), clean separation of concerns, no redundant or denormalized database fields.

### Approach 2: Rating Column on `Rsvp` (`Rsvp.rating`)

- **Why Rejected:** Tightly couples event attendance state with post-quiz evaluation. Exposes a high risk of leaking individual ratings into client roster payloads.

### Approach 3: Denormalized Columns on `Quiz` (`averageRating`, `ratingsCount`)

- **Why Rejected:** Violates the single-source-of-truth invariant, introduces dual-write transaction complexity, and offers no performance benefit given team sizes.

---

## 5. Detailed Design & Specifications

### 5.1 Database Model (`prisma/schema.prisma`)

```prisma
model QuizRating {
  id        String   @id @default(cuid())
  quizId    String
  memberId  String
  score     Int      // Constrained to 1, 2, 3, 4, 5 in domain service
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  quiz   Quiz   @relation(fields: [quizId], references: [id], onDelete: Cascade)
  member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([quizId, memberId])
  @@index([quizId])
  @@index([memberId])
}
```

Add relations to:

- `Quiz`: `ratings QuizRating[]`
- `Member`: `quizRatings QuizRating[]`

### 5.2 Service Layer (`src/services/ratingService.ts`)

#### Types:

```typescript
export interface QuizRatingSummary {
  average: number | null; // Rounded to 1 decimal place (e.g. 4.3), null if count === 0
  count: number; // Total ratings submitted
  totalEligible: number; // Number of active players who attended
  userScore: number | null; // The calling member's private score, or null
}
```

#### Methods:

1. `getQuizRatingSummary(quizId: string, currentMemberId?: string): Promise<QuizRatingSummary>`
   - Finds quiz and active team attendees (RSVPs with `ATTENDING`, ordered by `queuedSince`, sliced to `team.maxTeamSize`).
   - Extracts `activeMemberIds = activeRsvps.map(r => r.memberId)`.
   - Computes `totalEligible = activeMemberIds.length`.
   - **Dynamic Lineup Filter (Post-Quiz Roster Adjustments):**
     - Computes `average` and `count` strictly from `QuizRating` records where `memberId IN (activeMemberIds)`.
     - If a member previously rated but an admin subsequently demoted them to the reserve list (e.g. correcting who actually attended), their vote is automatically ignored in the aggregate score without destructive deletion.
     - If that member is restored to the active lineup, their rating automatically counts again.
   - Computes `userScore`: the calling member's submitted score IF they are currently in `activeMemberIds`, otherwise `null`.
   - Returns `{ average, count, totalEligible, userScore }`.
2. `submitQuizRating(params: { quizId: string; memberId: string; score: number }): Promise<QuizRatingSummary>`
   - Validation:
     - `score` must be an integer between 1 and 5.
     - Quiz must exist and status cannot be `CANCELLED`.
     - Quiz conclusion time (`startsAt + durationMinutes`) must be in the past (`<= new Date()`).
     - Member must be in the **active team lineup** (first `maxTeamSize` attending RSVPs by `queuedSince`). Waitlisted reserves are rejected with `NOT_ELIGIBLE`.
   - Mutation:
     - Upserts into `QuizRating` for `(quizId, memberId)`.
   - Returns fresh `QuizRatingSummary`.
3. `getBatchQuizRatings(quizIds: string[]): Promise<Map<string, { average: number; count: number }>>`
   - Uses Prisma `groupBy` to aggregate averages and counts across multiple quizzes in a single query for past dashboard cards.

### 5.3 Server Actions (`src/actions/rating.ts`)

- `rateQuizAction(quizId: string, score: number)`:
  - Validates active session via `getSession()`.
  - Re-checks attendance and quiz conclusion time.
  - Calls `submitQuizRating()`.
  - Calls `revalidatePath('/quizzes/[id]')` and `revalidatePath('/')`.
  - Returns `{ success: true, summary: QuizRatingSummary }` or standard action error object.

### 5.4 UI Components

1. **`QuizRatingWidget` (`src/components/QuizRatingWidget.tsx`):**
   - Placed on `QuizDetailClient.tsx` below the header / info section.
   - Conditionally rendered only when the quiz has concluded and `status !== 'CANCELLED'`.
   - **For Active Lineup Members:**
     - Displays title: _"Hoe was deze quiz?"_
     - 5 interactive star buttons (1 to 5). Hover/focus/tap highlights active stars.
     - Subtext: _"Jouw stem is anoniem en privé"_ + shows currently selected rating (e.g. _"Jouw stem: 4/5"_).
     - Team score footer: _"Teamscore: ★ 4.3 / 5 (3 van 4 spelers gestemd)"_.
     - Optimistic UI updates when tapping a star for instant feedback.
   - **For Non-Attending Members, Reserves & Visitors:**
     - Displays: _"Teambeoordeling"_.
     - Shows the aggregate average score (e.g. `4.3 ★★★★☆`) and vote count, or _"Nog geen beoordelingen"_ if none submitted.
2. **`QuizCard` Badge (`src/components/QuizCard.tsx`):**
   - For past quizzes with `averageRating != null`:
     - Displays an amber badge in the header: `★ {average.toFixed(1)}` (e.g. `★ 4.3`).

---

## 6. Verification & Test Plan

1. **Unit & Service Tests (`src/services/__tests__/ratingService.test.ts`):**
   - Test submitting rating for active lineup player.
   - Test updating existing rating (upsert behavior).
   - Test rejection when score is outside 1..5.
   - Test rejection when quiz is still in the future / not yet concluded.
   - Test rejection when quiz is `CANCELLED`.
   - Test rejection when member was on reserve/waitlist (outside `maxTeamSize`).
   - Test rejection when member declined or did not RSVP.
   - Test average rounding and empty summary (`null`).
2. **Integration / Server Action Tests (`src/actions/__tests__/rating.test.ts`):**
   - Test unauthenticated session rejection.
   - Test successful rating submission and revalidation trigger.
3. **End-to-End Consistency Checks:**
   - Run `npm run check:all` (typecheck, lint, formatting, secret scanning, security audit, all unit/integration tests).
