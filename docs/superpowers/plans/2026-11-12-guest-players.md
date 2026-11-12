# Guest Players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated team members and admins to add external guests by name to a quiz lineup, queueing them chronologically alongside registered members and displaying them with clear attribution.

**Architecture:** Maintain a single source of truth by enhancing the existing Prisma `Rsvp` model with optional `guestName` and `invitedById` fields. Existing FIFO queueing algorithms, waitlist calculations, and drag-and-drop reordering work out of the box on the unified collection. Pure client state is managed via `rsvpReducer` with optimistic updates.

**Tech Stack:** Next.js 16 (App Router, Server Actions), PostgreSQL, Prisma ORM, Vitest, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-11-11-guest-players-design.md`

## Global Constraints

- **No Git Commits Without Explicit Consent:** Never run `git commit` unless explicitly instructed or consented to by the human partner.
- **Single Source of Truth:** Never introduce parallel collections or duplicate state arrays for guest players; all lineup positions must live in `Rsvp`.
- **Pure Node-Based Deterministic Tests:** All service and reducer tests run under Vitest without unconfigured browser DOM dependencies.
- **Granular Permissions:** A guest can only be removed by the member who invited them (`invitedById === actorId`) or by an `ADMIN`.
- **Attendance Decoupling:** An inviter declining their own RSVP does not delete or alter their invited guests' status.

## Review Focus

1. **Guest Reordering Key Collision:** In `src/lib/rsvpReducer.ts`, reordering maps timestamps by key. If mapped by `memberId`, all guests (`memberId: null`) collide on key `null` and overwrite each other. Must key by `r.id`.
   - _Test:_ `tests/lib/rsvpReducer.test.ts` exercises reordering an active lineup containing multiple guests.
2. **Duplicate Guest Names by Same Inviter:** A member double-clicking submit or entering the same guest twice must receive a validation error.
   - _Test:_ `tests/services/guestRsvpService.test.ts` verifies adding duplicate case-insensitive guest name by the same inviter fails.
3. **Unauthorized Removal Attempt:** A non-admin member attempting to remove another teammate's guest must be rejected with 403 Forbidden.
   - _Test:_ `tests/services/guestRsvpService.test.ts` and `tests/actions/guestActions.test.ts` verify unauthorized removal throws `ForbiddenError`.
4. **Reserve Queue Promotion on Guest Deletion:** Deleting an active guest when a reserve player is waiting must promote the first reserve in FIFO order.
   - _Test:_ `tests/services/guestRsvpService.test.ts` verifies queue advancement upon guest removal.
5. **Lockdown Violation:** Adding or removing a guest after `startsAt` has passed must fail for non-admins and succeed for admins.
   - _Test:_ `tests/actions/guestActions.test.ts` tests lockdown verification.
6. **Calendar Subscriber Null-Safety on Domain Event:** Emitting `team.roster_changed` must not crash `subscriber.ts` when formatting lineups with guests (`r.member` is `null`).
   - _Test:_ `tests/services/guestRsvpService.test.ts` verifies calendar subscriber handles mixed lineups safely.
7. **Rating Eligibility Protection:** External guests in the active lineup must not inflate `totalEligible` in `ratingService.ts`.
   - _Test:_ `tests/services/guestRsvpService.test.ts` verifies rating summary calculation excludes guest entries.
8. **Identifier Contracts in Lineup & Actions:** `onAdminOverrideDecline` must receive `member.memberId!` and `QuizDetailClient` must compute current user index with `a.memberId === currentMemberId`.
   - _Test:_ `tests/components/TeamLineupGuests.test.tsx` and `tests/lib/rsvpReducer.test.ts`.

---

### Task 1: Prisma Schema & Database Migration

**Files:**

- Modify: `prisma/schema.prisma:131-152`
- Test: `tests/database/guestSchema.test.ts`

**Interfaces:**

- Produces: Updated Prisma Client with nullable `memberId`, new `guestName`, and `invitedById` fields on `Rsvp`, plus reverse relation `guestRsvps` on `Member`.

- [x] **Step 1: Write the failing integration test**

Write `tests/database/guestSchema.test.ts` asserting that an `Rsvp` can be created with `memberId: null`, `guestName: "Sarah"`, and `invitedById: testMember.id`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/database/guestSchema.test.ts`
Expected: FAIL due to missing `guestName` or non-nullable `memberId`.

- [x] **Step 3: Update `prisma/schema.prisma`**

Update `Rsvp` and `Member` models:

```prisma
model Member {
  ...
  guestRsvps   Rsvp[]   @relation("GuestInviter")
}

model Rsvp {
  id             String     @id @default(cuid())
  teamId         String
  team           Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)
  memberId       String?
  member         Member?    @relation(fields: [memberId], references: [id], onDelete: Restrict)
  guestName      String?
  invitedById    String?
  invitedBy      Member?    @relation("GuestInviter", fields: [invitedById], references: [id], onDelete: Restrict)
  status         RsvpStatus
  queuedSince    DateTime?
  overriddenById String?
  overriddenBy   Member?    @relation("RsvpOverrider", fields: [overriddenById], references: [id], onDelete: Restrict)
  overriddenAt   DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@unique([teamId, memberId])
  @@index([teamId, status, queuedSince])
  @@index([invitedById])
}
```

Run: `npx prisma db push`

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/database/guestSchema.test.ts`
Expected: PASS

---

### Task 2: Pure Domain Reducer & Client Lineup Logic

**Files:**

- Modify: `src/lib/rsvpReducer.ts`
- Test: `tests/lib/rsvpReducer.test.ts`

**Interfaces:**

- Consumes: `ClientRsvp`, `RsvpAction`
- Produces: Enhanced `rsvpReducer`, `deriveLineupRosters` with guest support and unique ID keying for reordering.

- [x] **Step 1: Write failing unit tests for guest reducer actions**

In `tests/lib/rsvpReducer.test.ts`, add test cases:

1. `ADD_GUEST`: Adds guest to state with `queuedSince`, `isGuest: true`, `name: "Sarah"`, `invitedByName: "Alice"`.
2. `REMOVE_GUEST`: Removes guest by `id`.
3. `ADMIN_REORDER`: Reordering a lineup containing multiple guests correctly assigns distinct timestamps without key collisions.
4. `deriveLineupRosters`: Correctly partitions mixed member and guest rosters into `active` and `reserves` based on `queuedSince`, populating both `id: r.id` (unique key) and `memberId: r.memberId`.
5. `USER_RSVP`: Adding a new member for the first time populates `id: action.memberId`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/rsvpReducer.test.ts`
Expected: FAIL on `ADD_GUEST` / `REMOVE_GUEST` action types.

- [x] **Step 3: Implement guest support in `src/lib/rsvpReducer.ts`**

Update `ClientRsvp`:

```ts
export interface ClientRsvp {
  id: string;
  memberId?: string | null;
  guestName?: string | null;
  invitedById?: string | null;
  invitedByName?: string | null;
  name: string;
  isGuest: boolean;
  status: "ATTENDING" | "DECLINED";
  queuedSince: Date | null;
}
```

Update `RsvpAction` to include `ADD_GUEST` and `REMOVE_GUEST`.
Update `USER_RSVP` case to set `id: action.memberId` when creating a new entry.
Fix `ADMIN_REORDER` to index reordered timestamps by `r.id`.
Update `deriveLineupRosters` to output `id: r.id`, `memberId: r.memberId`, `isGuest: Boolean(r.isGuest)`, `guestName: r.guestName`, `invitedById: r.invitedById`, and `invitedByName: r.invitedByName`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/rsvpReducer.test.ts`
Expected: PASS

---

### Task 3: Domain Service Layer & Downstream Subscribers

**Files:**

- Modify: `src/services/rsvpService.ts`
- Modify: `src/services/quizService.ts`
- Modify: `src/services/ratingService.ts`
- Modify: `src/features/calendar/shared/subscriber.ts`
- Test: `tests/services/guestRsvpService.test.ts`

**Interfaces:**

- Consumes: Prisma Client, `domainEvents`
- Produces: `addGuestRsvp(teamId, guestName, invitedById)`, `removeGuestRsvp(rsvpId, actorId, actorRole)`, updated `getRsvpLineup(teamId)` and `getQuizById(id)`, safe calendar subscriber mapping, and guest-filtered rating summaries.

- [x] **Step 1: Write failing domain service tests**

In `tests/services/guestRsvpService.test.ts`, test:

1. `addGuestRsvp` inserts guest with `status: "ATTENDING"` and emits `team.roster_changed`.
2. `addGuestRsvp` throws validation error on blank/whitespace name or name > 50 chars.
3. `addGuestRsvp` throws error if the same inviter adds duplicate case-insensitive guest name.
4. `removeGuestRsvp` by inviter deletes guest and emits `team.roster_changed`.
5. `removeGuestRsvp` by admin deletes guest.
6. `removeGuestRsvp` by non-inviter non-admin throws Forbidden error.
7. Deleting an active guest promotes next waitlisted player.
8. `getQuizRatingSummary` ignores active guest players when calculating `totalEligible`.
9. Calendar subscriber formats lineup safely without null pointer exception when guests attend.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/guestRsvpService.test.ts`
Expected: FAIL with "addGuestRsvp is not a function".

- [x] **Step 3: Implement domain service & subscriber changes**

1. In `src/services/rsvpService.ts`, implement `addGuestRsvp` and `removeGuestRsvp` with row lock `SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`.
2. In `src/services/rsvpService.ts`, update `getRsvpLineup` to include `invitedBy: true`.
3. In `src/services/quizService.ts`, update `rsvps` relation include in `getQuizById` and `getAllQuizzes` to include `invitedBy: true`.
4. In `src/services/ratingService.ts`, filter out null `memberId`s:
   ```ts
   const activeMemberIds = (quiz.team?.rsvps || [])
     .slice(0, maxTeamSize)
     .map((r) => r.memberId)
     .filter((id): id is string => Boolean(id));
   ```
5. In `src/features/calendar/shared/subscriber.ts`, use null-safe name mapping:
   ```ts
   const lineup = attendingRsvps
     .slice(0, quiz.team.maxTeamSize)
     .map(
       (r) =>
         r.member?.name ??
         (r.invitedBy ? `${r.guestName} (Gast van ${r.invitedBy.name})` : r.guestName) ??
         "Gast"
     );
   ```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/guestRsvpService.test.ts`
Expected: PASS

---

### Task 4: Server Actions Layer (`guestActions.ts`)

**Files:**

- Modify: `src/actions/rsvpActions.ts` (or create `src/actions/guestActions.ts`)
- Test: `tests/actions/guestActions.test.ts`

**Interfaces:**

- Consumes: `getSessionMember` from `@/lib/auth`, `rsvpService`
- Produces: `addGuestAction(teamId: string, guestName: string)`, `removeGuestAction(rsvpId: string, teamId: string)`

- [x] **Step 1: Write failing server action tests**

In `tests/actions/guestActions.test.ts`:

1. Unauthenticated call returns `{ success: false, error: "Niet ingelogd" }`.
2. Authenticated user can add guest.
3. Attempting to add/remove guest when quiz has started returns `{ success: false, error: "Quiz is vergrendeld" }` unless admin.
4. Non-inviter non-admin removing guest returns `{ success: false, error: "Geen toegang" }`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/actions/guestActions.test.ts`
Expected: FAIL

- [x] **Step 3: Implement server actions**

Implement `addGuestAction` and `removeGuestAction` verifying session, quiz lockdown, calling domain services, and revalidating `/quizzes/[id]`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/actions/guestActions.test.ts`
Expected: PASS

---

### Task 5: UI Components (`TeamLineup.tsx`, `AddGuestDialog.tsx`, `QuizDetailClient.tsx`, `QuizzesDashboard.tsx`)

**Files:**

- Modify: `src/components/TeamLineup.tsx`
- Create: `src/components/AddGuestDialog.tsx`
- Modify: `src/components/QuizDetailClient.tsx`
- Modify: `src/components/QuizzesDashboard.tsx`
- Test: `tests/components/TeamLineupGuests.test.tsx`

**Interfaces:**

- Consumes: `addGuestAction`, `removeGuestAction`, `TeamLineupProps`
- Produces: Interactive guest badge, remove button for inviter/admin, Add Guest dialog, and safe dashboard roster labels.

- [x] **Step 1: Write component unit test**

In `tests/components/TeamLineupGuests.test.tsx` (using `renderToStaticMarkup` from `react-dom/server` under Node test environment):

1. Renders guest name and badge: `Gast van Alice`.
2. Renders "Verwijderen" button if `currentMemberId === member.invitedById` or `isAdmin`.
3. Does NOT render "Verwijderen" button for other teammates.
4. "Afzeggen" override for members passes `member.memberId!` rather than `rsvp.id`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/TeamLineupGuests.test.tsx`
Expected: FAIL

- [x] **Step 3: Update components**

1. Update `TeamLineup.tsx`:
   - Handle `isGuest`, display `Gast van [invitedByName]`.
   - Render the delete button triggering `onRemoveGuest(member.rsvpId || member.id)`.
   - Ensure member override decline invokes `onAdminOverrideDecline(member.memberId!)`.
2. Create `AddGuestDialog.tsx` with name input and submit button.
3. Wire into `QuizDetailClient.tsx`:
   - Map `initialRsvps` with `id: r.id`, `memberId: r.memberId`, `guestName: r.guestName`, `invitedById: r.invitedById`, `invitedByName: r.invitedBy?.name`, `isGuest: Boolean(r.guestName || r.invitedById)`.
   - Fix `currentUserIndex` lookup: `attendees.findIndex((a) => a.memberId === currentMemberId)`.
   - Add "+ Gast toevoegen" trigger button.
   - Dispatch `ADD_GUEST` and `REMOVE_GUEST` to local reducer for instant optimistic UI.
   - Call `addGuestAction` and `removeGuestAction`.
4. Update `src/components/QuizzesDashboard.tsx`:
   - Set `memberName: r.member?.name || r.guestName || "Gast"`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/TeamLineupGuests.test.tsx`
Expected: PASS

---

### Task 6: Full Verification & Documentation Consistency

**Files:**

- Modify: `docs/database/schema.md`
- Modify: `docs/roadmap.md`

- [x] **Step 1: Run comprehensive codebase quality suite**

Run: `npm run check:all`
Expected: All typecheck, tests (all 67+ suites), lint, format, and audit checks PASS.

- [x] **Step 2: Update documentation**

1. Update `docs/database/schema.md` to document the nullable `memberId`, `guestName`, and `invitedById` fields and ERD relations.
2. Update `docs/roadmap.md` to reflect `[ ] Plan Ready: docs/superpowers/plans/2026-11-12-guest-players.md`.
