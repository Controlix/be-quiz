# Admin Member Lineup Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable administrators to enroll unresponded registered team members directly into a quiz lineup via a 1-tap dialog (`+ Teamlid toevoegen`) backed by existing row-locked RSVP override infrastructure.

**Architecture:** Reuse `adminOverrideAttendAction` and `rsvpService.adminOverrideAttend` (hardened to use session `currentMember.id`, revalidate `/quizzes/[id]`, and preserve `queuedSince` if already `ATTENDING`). Extend `rsvpReducer.ts` with an optional `name` on `ADMIN_OVERRIDE_ATTEND`, add a pure `deriveUnrespondedMembers` selector, render `EnrollMemberDialog.tsx` from `QuizDetailClient.tsx` beside `+ Gast toevoegen`, and supply `allMembers` from `src/app/quizzes/[id]/page.tsx` only for admins.

**Tech Stack:** Next.js 16 (App Router, RSC, Server Actions), React 19, TypeScript 6, Prisma 6 + PostgreSQL, Tailwind CSS v4, Vitest 5 (`environment: "node"`).

**Spec:** `docs/superpowers/specs/2026-11-21-admin-member-enrollment-design.md`

## Global Constraints

- Vitest runs strictly under `environment: "node"` (`vitest.config.ts`); component tests MUST use `renderToStaticMarkup` from `react-dom/server` without `jsdom` or `@testing-library/react`.
- Client RSVP state MUST remain a single unified `ClientRsvp[]` array in `rsvpReducer.ts` with pure derived selectors—zero parallel state arrays.
- Server Actions MUST enforce `currentMember.role === "ADMIN"` and source `overriddenById` exclusively from `currentMember.id`.
- NEVER run `git commit` without explicit user consent.
- Check off each step (`- [x]`) in this plan immediately upon completion before moving to the next step.

## Review Focus

1. **Already-`ATTENDING` concurrency guard:** Calling `adminOverrideAttend` when a member is already `ATTENDING` in PostgreSQL must preserve their existing `queuedSince` timestamp instead of bumping them to the back of the queue (tested in Task 1).
2. **Session `adminId` authority:** `adminOverrideAttendAction` must ignore any mismatched client-supplied `adminId` argument and pass `currentMember.id` to `adminOverrideAttend` (tested in Task 1).
3. **Never-responded member capacity placement:** Enrolling a member with no prior `Rsvp` row when `maxTeamSize` is full must place them in `reserves` with `overriddenById` recorded (tested in Task 1).
4. **Unresponded-only derivation & reducer idempotency:** `deriveUnrespondedMembers` must exclude both `ATTENDING` and `DECLINED` members (and guests with `memberId: null` must not break filtering), while `ADMIN_OVERRIDE_ATTEND` must be a no-op if the member is already `ATTENDING` in client state (tested in Task 2).
5. **Admin-only UI gating & optional `allMembers` prop:** `+ Teamlid toevoegen` must render only when `isAdmin === true`, and `<QuizDetailClient>` must render cleanly when `allMembers` is omitted (tested in Task 4).

---

### Task 1: Backend Service & Server Action Hardening

**Files:**

- Modify: `src/services/memberService.ts`
- Modify: `src/services/rsvpService.ts:147-189`
- Modify: `src/actions/adminActions.ts:152-171`
- Test: `tests/services/memberService.test.ts`
- Test: `tests/services/rsvpAdminOverride.test.ts`
- Test: `tests/admin/adminAttendAction.test.ts`

**Interfaces:**

- Produces in `@/services/memberService`: `getAllMembers(): Promise<Array<{ id: string; name: string }>>`
- Produces in `@/services/rsvpService`: `adminOverrideAttend(teamId: string, memberId: string, adminId: string): Promise<{ quizId: string }>`
- Produces in `@/actions/adminActions`: `adminOverrideAttendAction(teamId: string, memberId: string, _adminId?: string): Promise<{ success: boolean; error?: string }>`

- [x] **Step 1: Write failing tests for `getAllMembers`, `adminOverrideAttend` (never-responded + already-`ATTENDING` guard), and `adminOverrideAttendAction` session audit & revalidation**

Add to `tests/services/memberService.test.ts`:

```ts
import { updateMemberRole, getAllMembers } from "../../src/services/memberService";

describe("memberService.getAllMembers", () => {
  it("returns member id and name sorted alphabetically", async () => {
    const suffix = Date.now();
    await prisma.member.create({ data: { name: `Zara-${suffix}` } });
    await prisma.member.create({ data: { name: `Anna-${suffix}` } });

    const members = await getAllMembers();
    const zaraIndex = members.findIndex((m) => m.name === `Zara-${suffix}`);
    const annaIndex = members.findIndex((m) => m.name === `Anna-${suffix}`);

    expect(annaIndex).toBeGreaterThanOrEqual(0);
    expect(zaraIndex).toBeGreaterThan(annaIndex);
    expect(Object.keys(members[annaIndex]).sort()).toEqual(["id", "name"]);
  });
});
```

Add to `tests/services/rsvpAdminOverride.test.ts`:

```ts
it("enrolls a never-responded member into reserves when team is full and returns quizId", async () => {
  const admin = await prisma.member.create({
    data: { name: `AdminNever-${Date.now()}`, role: "ADMIN" },
  });
  const quiz = await createQuiz(
    {
      title: "Never Responded Quiz",
      startsAt: new Date(Date.now() + 86400000),
      location: "Gent",
      maxTeamSize: 1,
    },
    admin.id
  );
  const activePlayer = await prisma.member.create({ data: { name: `First-${Date.now()}` } });
  const unresponded = await prisma.member.create({ data: { name: `Silent-${Date.now()}` } });

  await setRsvp(quiz.team!.id, activePlayer.id, "ATTENDING");
  const result = await adminOverrideAttend(quiz.team!.id, unresponded.id, admin.id);

  expect(result).toEqual({ quizId: quiz.id });
  const { active, reserves } = await getRsvpLineup(quiz.team!.id);
  expect(active.map((a) => a.memberId)).toEqual([activePlayer.id]);
  expect(reserves.map((r) => r.memberId)).toEqual([unresponded.id]);
  expect(reserves[0].overriddenById).toBe(admin.id);
});

it("preserves existing queuedSince when member is already ATTENDING", async () => {
  const admin = await prisma.member.create({
    data: { name: `AdminPres-${Date.now()}`, role: "ADMIN" },
  });
  const quiz = await createQuiz(
    {
      title: "Preserve Queue Quiz",
      startsAt: new Date(Date.now() + 86400000),
      location: "Gent",
      maxTeamSize: 4,
    },
    admin.id
  );
  const member = await prisma.member.create({ data: { name: `AlreadyIn-${Date.now()}` } });

  await setRsvp(quiz.team!.id, member.id, "ATTENDING");
  const before = await prisma.rsvp.findUniqueOrThrow({
    where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  await adminOverrideAttend(quiz.team!.id, member.id, admin.id);

  const after = await prisma.rsvp.findUniqueOrThrow({
    where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
  });
  expect(after.queuedSince?.getTime()).toBe(before.queuedSince?.getTime());
});
```

Update `tests/admin/adminAttendAction.test.ts` to verify session `currentMember.id` and quiz detail revalidation:

```ts
import { revalidatePath } from "next/cache";

it("uses session currentMember.id rather than client adminId and revalidates quiz detail path", async () => {
  vi.spyOn(auth, "getSessionMember").mockResolvedValue({
    id: "real-admin",
    role: "ADMIN",
    name: "Real Admin",
  } as any);
  vi.spyOn(rsvpService, "adminOverrideAttend").mockResolvedValue({ quizId: "quiz-42" });

  const result = await adminOverrideAttendAction("team-1", "member-1", "spoofed-admin");
  expect(result.success).toBe(true);
  expect(rsvpService.adminOverrideAttend).toHaveBeenCalledWith("team-1", "member-1", "real-admin");
  expect(revalidatePath).toHaveBeenCalledWith("/quizzes");
  expect(revalidatePath).toHaveBeenCalledWith("/quizzes/quiz-42");
});
```

- [x] **Step 2: Run the targeted backend & action tests to verify they fail**

Run: `npx vitest run tests/services/memberService.test.ts tests/services/rsvpAdminOverride.test.ts tests/admin/adminAttendAction.test.ts`
Expected: FAIL (`getAllMembers` undefined, `adminOverrideAttend` returns `undefined` / resets `queuedSince`, `adminOverrideAttendAction` forwards `"spoofed-admin"` and does not revalidate `/quizzes/quiz-42`).

- [x] **Step 3: Implement `getAllMembers` in `src/services/memberService.ts`**

Add `getAllMembers(): Promise<Array<{ id: string; name: string }>>` querying `prisma.member.findMany` with `select: { id: true, name: true }` and `orderBy: { name: "asc" }`.

- [x] **Step 4: Update `adminOverrideAttend` in `src/services/rsvpService.ts`**

Inside the `prisma.$transaction` after `SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`:

1. Check `const existing = await tx.rsvp.findUnique({ where: { teamId_memberId: { teamId, memberId } }, select: { status: true } })`.
2. Only run `tx.rsvp.upsert(...)` if `existing?.status !== "ATTENDING"` (preserving original `queuedSince` when already `ATTENDING`).
3. Fetch `team` (`select: { quizId: true }`), emit `"team.roster_changed"` when `existing?.status !== "ATTENDING"`, and return `{ quizId: team.quizId }`.

- [x] **Step 5: Harden `adminOverrideAttendAction` in `src/actions/adminActions.ts`**

Keep the signature `(teamId: string, memberId: string, _adminId?: string)` for backwards compatibility, call `const result = await adminOverrideAttend(teamId, memberId, currentMember.id)`, and place both `revalidatePath("/quizzes")` and `if (result?.quizId) revalidatePath("/quizzes/" + result.quizId)` inside the inner `try { ... } catch {}` block (so non-Next-request tests do not fail on missing cache context).

- [x] **Step 6: Run targeted tests to verify they pass**

Run: `npx vitest run tests/services/memberService.test.ts tests/services/rsvpAdminOverride.test.ts tests/admin/adminAttendAction.test.ts`
Expected: PASS

---

### Task 2: Client State Reducer & Unresponded Member Derivation

**Files:**

- Modify: `src/lib/rsvpReducer.ts`
- Test: `tests/lib/rsvpReducer.test.ts`

**Interfaces:**

- Produces in `@/lib/rsvpReducer`:
  - `RsvpAction` variant `{ type: "ADMIN_OVERRIDE_ATTEND"; memberId: string; name?: string }`
  - `deriveUnrespondedMembers(allMembers: Array<{ id: string; name: string }>, rsvps: ClientRsvp[]): Array<{ id: string; name: string }>`

- [x] **Step 1: Write failing tests in `tests/lib/rsvpReducer.test.ts`**

```ts
import {
  rsvpReducer,
  deriveCurrentUserStatus,
  deriveLineupRosters,
  deriveUnrespondedMembers,
  ClientRsvp,
} from "../../src/lib/rsvpReducer";

it("enrolls an unresponded member via ADMIN_OVERRIDE_ATTEND with provided name", () => {
  const nextState = rsvpReducer(initial, {
    type: "ADMIN_OVERRIDE_ATTEND",
    memberId: "member-3",
    name: "Charlie",
  });

  expect(deriveCurrentUserStatus(nextState, "member-3")).toBe("ATTENDING");
  const { attendees } = deriveLineupRosters(nextState, "admin-1");
  expect(attendees.some((a) => a.memberId === "member-3" && a.name === "Charlie")).toBe(true);
});

it("keeps existing queuedSince unchanged if ADMIN_OVERRIDE_ATTEND targets an already ATTENDING member", () => {
  const originalTime = initial[0].queuedSince;
  const nextState = rsvpReducer(initial, {
    type: "ADMIN_OVERRIDE_ATTEND",
    memberId: "admin-1",
    name: "Admin Alex",
  });

  expect(nextState).toBe(initial);
  expect(nextState[0].queuedSince).toBe(originalTime);
});

it("derives only unresponded members (excluding both ATTENDING, DECLINED, and ignoring guest rows)", () => {
  const stateWithGuest: ClientRsvp[] = [
    ...initial,
    {
      id: "guest-1",
      memberId: null,
      guestName: "Sarah",
      name: "Sarah",
      isGuest: true,
      status: "ATTENDING",
      queuedSince: new Date(3000),
    },
  ];
  const allMembers = [
    { id: "admin-1", name: "Admin Alex" },
    { id: "user-2", name: "User Bob" },
    { id: "user-3", name: "Charlie" },
    { id: "user-4", name: "Dana" },
  ];

  expect(deriveUnrespondedMembers(allMembers, stateWithGuest)).toEqual([
    { id: "user-3", name: "Charlie" },
    { id: "user-4", name: "Dana" },
  ]);
});
```

- [x] **Step 2: Run reducer tests to verify they fail**

Run: `npx vitest run tests/lib/rsvpReducer.test.ts`
Expected: FAIL (`deriveUnrespondedMembers` is not exported, unresponded `ADMIN_OVERRIDE_ATTEND` does not add entry).

- [x] **Step 3: Update `src/lib/rsvpReducer.ts`**

1. Extend `RsvpAction`: `{ type: "ADMIN_OVERRIDE_ATTEND"; memberId: string; name?: string }`.
2. In `case "ADMIN_OVERRIDE_ATTEND"`:
   - Look up `existing = state.find((r) => r.memberId === action.memberId)`.
   - If `existing?.status === "ATTENDING"`, return `state`.
   - If `existing`, map to `{ ...r, status: "ATTENDING", queuedSince: new Date() }`.
   - Otherwise append `{ id: action.memberId, memberId: action.memberId, name: action.name || "Teamlid", isGuest: false, status: "ATTENDING", queuedSince: new Date() }`.
3. Export `deriveUnrespondedMembers(allMembers: Array<{ id: string; name: string }>, rsvps: ClientRsvp[]): Array<{ id: string; name: string }>`, building a `Set` of truthy `r.memberId` values and returning `allMembers.filter((m) => !respondedIds.has(m.id))`.

- [x] **Step 4: Run reducer tests to verify they pass**

Run: `npx vitest run tests/lib/rsvpReducer.test.ts`
Expected: PASS

---

### Task 3: `EnrollMemberDialog` Component

**Files:**

- Create: `src/components/EnrollMemberDialog.tsx`
- Test: `tests/components/EnrollMemberDialog.test.tsx`

**Interfaces:**

- Produces in `@/components/EnrollMemberDialog`:
  - `EnrollMemberDialogProps`: `{ isOpen: boolean; onClose: () => void; availableMembers: Array<{ id: string; name: string }>; onEnroll: (memberId: string, memberName: string) => Promise<void> | void; isSubmitting?: boolean }`
  - `EnrollMemberDialog(props: EnrollMemberDialogProps)`

- [x] **Step 1: Write failing markup tests in `tests/components/EnrollMemberDialog.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollMemberDialog } from "../../src/components/EnrollMemberDialog";

describe("EnrollMemberDialog Component", () => {
  it("returns empty markup when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={false}
        onClose={vi.fn()}
        availableMembers={[{ id: "m1", name: "Charlie" }]}
        onEnroll={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("renders eligible unresponded members as clickable button rows when open", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={true}
        onClose={vi.fn()}
        availableMembers={[
          { id: "m1", name: "Charlie" },
          { id: "m2", name: "Dana" },
        ]}
        onEnroll={vi.fn()}
      />
    );

    expect(html).toContain("Teamlid toevoegen");
    expect(html).toContain("Charlie");
    expect(html).toContain("Dana");
    expect(html).toContain("<button");
  });

  it("renders empty state message when no unresponded members remain", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={true}
        onClose={vi.fn()}
        availableMembers={[]}
        onEnroll={vi.fn()}
      />
    );

    expect(html).toContain("Alle teamleden hebben al gereageerd.");
    expect(html).toContain("Sluiten");
  });

  it("disables member rows when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={true}
        onClose={vi.fn()}
        availableMembers={[{ id: "m1", name: "Charlie" }]}
        onEnroll={vi.fn()}
        isSubmitting={true}
      />
    );

    expect(html).toContain("disabled");
  });
});
```

- [x] **Step 2: Run component tests to verify they fail**

Run: `npx vitest run tests/components/EnrollMemberDialog.test.tsx`
Expected: FAIL (cannot resolve `../../src/components/EnrollMemberDialog`).

- [x] **Step 3: Implement `src/components/EnrollMemberDialog.tsx`**

Follow `src/components/AddGuestDialog.tsx` modal layout (`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs`, `max-w-sm rounded-2xl bg-white p-5 shadow-xl`):

- Track local `error: string | null` and `pendingMemberId: string | null` (combined with `isSubmitting` via `const busy = isSubmitting || pendingMemberId !== null`).
- Define a shared `handleClose` that guards `if (busy) return;`, clears `error`, and calls `onClose()`.
- Header with `UserPlus` badge, title `"Teamlid toevoegen"`, and close button (`onClick={handleClose}`, `disabled={busy}`).
- If `availableMembers.length === 0`: render `"Alle teamleden hebben al gereageerd."` and a `"Sluiten"` button (`onClick={handleClose}`, `disabled={busy}`).
- Otherwise render a scrollable list (`max-h-72 space-y-1.5 overflow-y-auto`) of full-width `<button key={member.id} type="button" disabled={busy}>` rows displaying `member.name` (and a subtle `"Bezig..."` label on `pendingMemberId === member.id`).
- On row click: clear error, set `pendingMemberId`, `try` awaiting `onEnroll(member.id, member.name)` and calling `onClose()` on success, `catch (err)` to display `err.message || "Fout bij aanmelden van teamlid"` inline without closing, and `finally` reset `setPendingMemberId(null)` so rows are re-enabled after errors.

- [x] **Step 4: Run component tests to verify they pass**

Run: `npx vitest run tests/components/EnrollMemberDialog.test.tsx`
Expected: PASS

---

### Task 4: Page & `QuizDetailClient` Wiring + Documentation Sync

**Files:**

- Modify: `src/app/quizzes/[id]/page.tsx`
- Modify: `src/components/QuizDetailClient.tsx`
- Modify: `docs/roadmap.md`
- Modify: `docs/architecture/rsvp-state.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/superpowers/specs/2026-11-21-admin-member-enrollment-design.md`
- Test: `tests/components/QuizDetailEnroll.test.tsx`

**Interfaces:**

- Consumes: `getAllMembers` from `@/services/memberService`, `deriveUnrespondedMembers` from `@/lib/rsvpReducer`, `EnrollMemberDialog` from `@/components/EnrollMemberDialog`, `adminOverrideAttendAction` from `@/actions/adminActions`
- Updates `QuizDetailClientProps` in `src/components/QuizDetailClient.tsx` with optional `allMembers?: Array<{ id: string; name: string }>` (default `[]`).

- [x] **Step 1: Write failing integration markup tests in `tests/components/QuizDetailEnroll.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { CapabilitiesProvider } from "../../src/features/capabilities";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("QuizDetailClient Admin Member Enrollment Trigger", () => {
  const baseQuiz = {
    id: "quiz-1",
    title: "Pubquiz",
    startsAt: new Date(Date.now() + 86400000),
    location: "Gent",
    durationMinutes: 180,
    entryFee: null,
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [],
    },
  };

  const defaultCaps = {
    vision: false,
    icalExport: false,
    whatsappShare: false,
    emailRegistration: false,
    sharedGoogleCalendar: false,
  };

  it("renders + Teamlid toevoegen beside + Gast toevoegen for admins", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={baseQuiz}
          currentMemberId="admin-1"
          currentMemberName="Admin"
          isAdmin={true}
          allMembers={[{ id: "m2", name: "Charlie" }]}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("+ Teamlid toevoegen");
  });

  it("does not render + Teamlid toevoegen for regular non-admin users", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={baseQuiz}
          currentMemberId="user-1"
          currentMemberName="User"
          isAdmin={false}
          allMembers={[{ id: "m2", name: "Charlie" }]}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("+ Gast toevoegen");
    expect(html).not.toContain("+ Teamlid toevoegen");
  });

  it("renders cleanly for admins when allMembers prop is omitted", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={baseQuiz}
          currentMemberId="admin-1"
          currentMemberName="Admin"
          isAdmin={true}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("+ Teamlid toevoegen");
  });
});
```

- [x] **Step 2: Run the new integration markup test to verify it fails**

Run: `npx vitest run tests/components/QuizDetailEnroll.test.tsx`
Expected: FAIL (`+ Teamlid toevoegen` is not rendered yet).

- [x] **Step 3: Wire `allMembers` in `src/app/quizzes/[id]/page.tsx`**

Import `getAllMembers` from `@/services/memberService`. Fetch `const allMembers = currentMember.role === "ADMIN" ? await getAllMembers() : [];` and pass `allMembers={allMembers}` to `<QuizDetailClient />`.

- [x] **Step 4: Wire `+ Teamlid toevoegen` and `EnrollMemberDialog` in `src/components/QuizDetailClient.tsx`**

1. Import `EnrollMemberDialog` and `deriveUnrespondedMembers`.
2. Add optional `allMembers?: Array<{ id: string; name: string }>` to `QuizDetailClientProps` (default `[]`).
3. Derive `const enrollableMembers = deriveUnrespondedMembers(allMembers, rsvps);`.
4. Add `isEnrollMemberOpen` and `isEnrollingMember` states.
5. Render `<button type="button" onClick={() => setIsEnrollMemberOpen(true)} ...>+ Teamlid toevoegen</button>` inside the action bar right next to `+ Gast toevoegen` when `isAdmin === true` (using `flex flex-wrap items-center gap-2` so both wrap cleanly on narrow mobile viewports).
6. Add `handleEnrollMember(memberId: string, memberName: string)` (matching `handleAddGuest`): sets `isEnrollingMember(true)`, awaits `adminOverrideAttendAction(team.id, memberId, currentMemberId)`, throws `new Error(res.error || "Fout bij aanmelden van teamlid")` if `!res.success`, and dispatches `{ type: "ADMIN_OVERRIDE_ATTEND", memberId, name: memberName }` on success.
7. Update `handleAdminOverrideAttend(memberId: string)` (for `TeamLineup`'s `+ Aanmelden` chip) to await `const res = await adminOverrideAttendAction(team.id, memberId, currentMemberId)` **before** dispatching `{ type: "ADMIN_OVERRIDE_ATTEND", memberId }`, and call `setErrorMessage(res.error || "Fout bij aanmelden van speler")` if `!res.success` (avoiding stale optimistic state on failure).
8. Render `<EnrollMemberDialog isOpen={isEnrollMemberOpen} onClose={() => setIsEnrollMemberOpen(false)} availableMembers={enrollableMembers} onEnroll={handleEnrollMember} isSubmitting={isEnrollingMember} />`.

- [x] **Step 5: Sync documentation in `docs/roadmap.md`, `docs/architecture/`, and the design spec**

1. Verify `docs/roadmap.md` Item #10 (`Status:` and `Scope:`) references `EnrollMemberDialog.tsx`, `adminOverrideAttendAction`, and links this plan (updating if needed).
2. In `docs/architecture/rsvp-state.md`:
   - Update the `ADMIN_OVERRIDE_ATTEND` row in the `RsvpAction` table to mention both `+ Aanmelden` on declined chips and enrolling unresponded members via `+ Teamlid toevoegen` (with optional `name`), noting that an already-`ATTENDING` entry is a no-op preserving `queuedSince`.
   - Document `deriveUnrespondedMembers()` under Section 4 (`Pure Derivation`) alongside `deriveCurrentUserStatus()` and `deriveLineupRosters()`.
3. In `docs/architecture/overview.md`, update `_Override Attend_` (under Section 4.2) to mention enrolling unresponded registered teammates in addition to previously declined or reserve players.
4. In `docs/superpowers/specs/2026-11-21-admin-member-enrollment-design.md`, update `**Status:**` from `In Review` to `Implemented`.

- [x] **Step 6: Run targeted component tests and full verification pipeline**

Run: `npx vitest run tests/components/QuizDetailEnroll.test.tsx tests/components/QuizDetailDeclined.test.tsx tests/components/QuizDetailFlyer.test.tsx tests/ui/quizRatingIntegration.test.tsx`
Expected: PASS

Run: `npm run check:all`
Expected: Typecheck, full Vitest suite, ESLint, Prettier, `audit-ci`, and `secretlint` all pass with exit code 0.

- [x] **Step 7: Feature closeout (`documenting-feature-release`)**

Invoke the `documenting-feature-release` skill before claiming work is complete to update `CHANGELOG.md`, archive Roadmap Item #10 out of `docs/roadmap.md` into `docs/superpowers/feedback/archive-<milestone>-completed.md`, and complete the 6-gate release checklist (asking the user before creating any git commits or tags).
