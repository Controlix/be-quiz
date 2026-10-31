# Unified RSVP State & UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor RSVP client state in `QuizDetailClient.tsx` to use a pure state reducer (`rsvpReducer.ts`) so that `RsvpControl` and `TeamLineup` can never fall out of sync.

**Architecture:** Create `src/lib/rsvpReducer.ts` containing the `ClientRsvp` type, `rsvpReducer`, `deriveCurrentUserStatus`, and `deriveLineupRosters`. Refactor `QuizDetailClient.tsx` to use `useReducer(rsvpReducer, initialRsvps)` and derive all props from this single source of truth.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-unified-rsvp-state-design.md`

## Global Constraints

- **No Schema Migrations:** Pure frontend state refactoring; database models remain untouched.
- **Strict Step-by-Step Plan Checklist Discipline:** Update plan checkboxes (`- [x]`) immediately after completing each step.
- **Mandatory Instant Feedback:** State WHAT and WHY before executing any tool call.
- **No Git Commits Without Explicit Consent:** Do not commit unless requested.

## Review Focus

1. **Self-override decline:** When an admin overrides their own RSVP to declined, `deriveCurrentUserStatus` must return `"DECLINED"`.
2. **Self-override attend:** When an admin re-enrolls themselves from "Afgemeld", `deriveCurrentUserStatus` must return `"ATTENDING"`.
3. **Reordering with declined members:** Reordering active attendees via drag-and-drop must preserve declined members untouched in the single `rsvps` array.
4. **First-time RSVP:** A member RSVPing for the first time (no prior record in `rsvps`) must cleanly add their entry to `rsvps`.
5. **No prop drift:** `RsvpControl` and `TeamLineup` prop interfaces must remain untouched.

---

### Task 1: Reducer & State Derivation Functions (`src/lib/rsvpReducer.ts`)

**Files:**
- Create: `src/lib/rsvpReducer.ts`
- Test: `tests/lib/rsvpReducer.test.ts`

**Interfaces:**
- Produces: `ClientRsvp`, `RsvpAction`, `rsvpReducer`, `deriveCurrentUserStatus`, `deriveLineupRosters`

- [x] **Step 1: Write the failing tests**

Create `tests/lib/rsvpReducer.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  rsvpReducer,
  deriveCurrentUserStatus,
  deriveLineupRosters,
  ClientRsvp,
} from "../../src/lib/rsvpReducer";

describe("rsvpReducer & State Derivations", () => {
  const initial: ClientRsvp[] = [
    {
      memberId: "admin-1",
      name: "Admin Alex",
      status: "ATTENDING",
      queuedSince: new Date(1000),
    },
    {
      memberId: "user-2",
      name: "User Bob",
      status: "DECLINED",
      queuedSince: null,
    },
  ];

  it("derives current user status correctly", () => {
    expect(deriveCurrentUserStatus(initial, "admin-1")).toBe("ATTENDING");
    expect(deriveCurrentUserStatus(initial, "user-2")).toBe("DECLINED");
    expect(deriveCurrentUserStatus(initial, "unknown")).toBeNull();
  });

  it("derives active attendees and declined members cleanly", () => {
    const { attendees, declined } = deriveLineupRosters(initial, "admin-1");
    expect(attendees.length).toBe(1);
    expect(attendees[0].name).toBe("Admin Alex (jij)");
    expect(declined.length).toBe(1);
    expect(declined[0].name).toBe("User Bob");
  });

  // Review Focus #1: Self-override decline
  it("synchronizes status when an admin overrides their own RSVP to declined", () => {
    const nextState = rsvpReducer(initial, {
      type: "ADMIN_OVERRIDE_DECLINE",
      memberId: "admin-1",
    });

    expect(deriveCurrentUserStatus(nextState, "admin-1")).toBe("DECLINED");
    const { attendees, declined } = deriveLineupRosters(nextState, "admin-1");
    expect(attendees.length).toBe(0);
    expect(declined.length).toBe(2);
    expect(declined.some((d) => d.id === "admin-1")).toBe(true);
  });

  // Review Focus #2: Self-override attend
  it("synchronizes status when an admin re-enrolls themselves to attending", () => {
    const declinedState = rsvpReducer(initial, {
      type: "ADMIN_OVERRIDE_DECLINE",
      memberId: "admin-1",
    });

    const attendState = rsvpReducer(declinedState, {
      type: "ADMIN_OVERRIDE_ATTEND",
      memberId: "admin-1",
    });

    expect(deriveCurrentUserStatus(attendState, "admin-1")).toBe("ATTENDING");
    const { attendees, declined } = deriveLineupRosters(attendState, "admin-1");
    expect(attendees.length).toBe(1);
    expect(attendees[0].id).toBe("admin-1");
    expect(declined.length).toBe(1);
    expect(declined[0].id).toBe("user-2");
  });

  // Review Focus #4: First-time RSVP
  it("adds new member entry when RSVPing for the first time", () => {
    const nextState = rsvpReducer(initial, {
      type: "USER_RSVP",
      memberId: "new-user",
      name: "Newbie",
      status: "ATTENDING",
    });

    expect(deriveCurrentUserStatus(nextState, "new-user")).toBe("ATTENDING");
    const { attendees } = deriveLineupRosters(nextState, "new-user");
    expect(attendees.length).toBe(2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/rsvpReducer.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/rsvpReducer'"

- [x] **Step 3: Implement `src/lib/rsvpReducer.ts`**

Create `src/lib/rsvpReducer.ts` exporting types and pure functions as specified in the design doc.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/rsvpReducer.test.ts`
Expected: PASS

---

### Task 2: Refactor `QuizDetailClient.tsx` to Use Reducer

**Files:**
- Modify: `src/components/QuizDetailClient.tsx`
- Test: `tests/components/QuizDetailDeclined.test.tsx`

**Interfaces:**
- Consumes: `rsvpReducer`, `deriveCurrentUserStatus`, `deriveLineupRosters`, `ClientRsvp` from `@/lib/rsvpReducer`
- Produces: Clean derived props for `RsvpControl` and `TeamLineup` with no duplicate state.

- [x] **Step 1: Update `src/components/QuizDetailClient.tsx` to use `useReducer`**
  1. Replace `attendees`, `declinedMembers`, `currentUserRsvp` state with `useReducer(rsvpReducer, initialRsvps)`.
  2. Derive `currentUserRsvp = deriveCurrentUserStatus(rsvps, currentMemberId)`.
  3. Derive `{ attendees, declined: declinedMembers } = deriveLineupRosters(rsvps, currentMemberId)`.
  4. Update `handleRsvpChange` to dispatch `USER_RSVP`.
  5. Update `confirmAdminOverrideDecline` to dispatch `ADMIN_OVERRIDE_DECLINE`.
  6. Update `handleAdminOverrideAttend` to dispatch `ADMIN_OVERRIDE_ATTEND`.
  7. Update `handleReorder` to dispatch `ADMIN_REORDER`.

- [x] **Step 2: Run component tests to verify they pass**

Run: `npx vitest run tests/components/QuizDetailDeclined.test.tsx`
Expected: PASS

---

### Task 3: Full Test Suite Verification & Cleanup

**Files:**
- Modify: `docs/roadmap.md`

- [x] **Step 1: Run full Vitest suite**

Run: `npm test`
Expected: All tests pass.

- [x] **Step 2: Run production build check**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [x] **Step 3: Archive completed item from `docs/roadmap.md`**

Archive to `docs/superpowers/feedback/archive-v1.1-completed.md` and clean up `docs/roadmap.md`.
