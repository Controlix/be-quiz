# Declined Players Visibility & Admin Re-enroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow teammates to see who explicitly declined an upcoming quiz on the detail page, and empower admins to re-enroll declined players directly from the lineup.

**Architecture:** Extend the existing RSVP service with an `adminOverrideAttend` function reusing the existing audit fields (`overriddenById`, `overriddenAt`) on the `Rsvp` model. Expose this through a protected Next.js server action `adminOverrideAttendAction`. Update `TeamLineup.tsx` to render an always-visible, muted "Afgemeld" section of chips with an admin "+ Aanmelden" button, and wire `QuizDetailClient.tsx` with optimistic state management for seamless toggling.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, TypeScript, Prisma ORM (PostgreSQL), Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-declined-players-visibility-design.md`

## Global Constraints

- **No Schema Migrations:** Re-use the existing Prisma schema (`status: DECLINED`, `overriddenById`, `overriddenAt` on `Rsvp`).
- **No Git Commits Without Explicit Consent:** Do not execute `git commit` unless explicitly instructed.
- **Mandatory Instant Feedback:** State WHAT and WHY before executing any tool call.
- **Strict FIFO Queuing:** Re-enrolling a player sets `queuedSince: new Date()`, placing them at the end of the attending/reserve queue without disturbing existing timestamps.
- **Drag-and-Drop Isolation:** Reordering indexes must remain strictly bounded to attending players (`active` + `reserves`).

## Review Focus

1. **Re-enrolling when team is already at max capacity:** Player must land in `reserves` (as Reserve #N) rather than exceeding `maxTeamSize`.
2. **Re-enrolling a member who previously had no RSVP record at all:** `adminOverrideAttend` must upsert correctly into `status: "ATTENDING"`.
3. **Optimistic RSVP toggle back-and-forth:** Toggling between "Ik doe mee" and "Ik pas" on the client must cleanly add/remove names between `attendees` and `declinedMembers` without duplicates.
4. **Admin authorization guard:** Non-admin callers attempting to invoke `adminOverrideAttendAction` must receive an authorization error and have no database changes applied.
5. **Zero declined players state:** When no players have declined, the "Afgemeld" section must not render any HTML markup or empty containers.

---

### Task 1: Backend Service `adminOverrideAttend`

**Files:**
- Create: `tests/services/rsvpAdminOverride.test.ts`
- Modify: `src/services/rsvpService.ts`

**Interfaces:**
- Consumes: Prisma client (`@/lib/db`)
- Produces: `adminOverrideAttend(teamId: string, memberId: string, adminId: string): Promise<void>`

- [x] **Step 1: Write the failing test**

Create `tests/services/rsvpAdminOverride.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup, adminOverrideDecline, adminOverrideAttend } from "../../src/services/rsvpService";

describe("adminOverrideAttend Service", () => {
  it("re-enrolls a declined player to ATTENDING, updates queuedSince, and records admin audit info", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz(
      { title: "Attend Override Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 4 },
      admin.id
    );
    const member = await prisma.member.create({ data: { name: `DeclinedPlayer-${Date.now()}` } });

    // Step 1: Member declines
    await setRsvp(quiz.team!.id, member.id, "DECLINED");
    const rsvpDeclined = await prisma.rsvp.findUnique({
      where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
    });
    expect(rsvpDeclined?.status).toBe("DECLINED");

    // Step 2: Admin overrides to attend
    await adminOverrideAttend(quiz.team!.id, member.id, admin.id);
    const rsvpAttending = await prisma.rsvp.findUnique({
      where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
    });
    expect(rsvpAttending?.status).toBe("ATTENDING");
    expect(rsvpAttending?.queuedSince).toBeInstanceOf(Date);
    expect(rsvpAttending?.overriddenById).toBe(admin.id);
    expect(rsvpAttending?.overriddenAt).toBeInstanceOf(Date);

    // Step 3: Verify they appear in the lineup
    const { active } = await getRsvpLineup(quiz.team!.id);
    expect(active.some((a) => a.memberId === member.id)).toBe(true);
  });

  // Review Focus #1: Capacity check
  it("places re-enrolled player into reserves when active spots are full", async () => {
    const admin = await prisma.member.create({ data: { name: `AdminCap-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz(
      { title: "Full Capacity Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 1 },
      admin.id
    );
    const m1 = await prisma.member.create({ data: { name: `Active1-${Date.now()}` } });
    const m2 = await prisma.member.create({ data: { name: `Reserve1-${Date.now()}` } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "DECLINED");

    await adminOverrideAttend(quiz.team!.id, m2.id, admin.id);
    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(1);
    expect(active[0].memberId).toBe(m1.id);
    expect(reserves.length).toBe(1);
    expect(reserves[0].memberId).toBe(m2.id);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/rsvpAdminOverride.test.ts`
Expected: FAIL with "adminOverrideAttend is not a function"

- [x] **Step 3: Implement `adminOverrideAttend` in `src/services/rsvpService.ts`**

Implement:
```typescript
export async function adminOverrideAttend(
  teamId: string,
  memberId: string,
  adminId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    await tx.rsvp.upsert({
      where: {
        teamId_memberId: {
          teamId,
          memberId,
        },
      },
      update: {
        status: "ATTENDING",
        queuedSince: new Date(),
        overriddenById: adminId,
        overriddenAt: new Date(),
      },
      create: {
        teamId,
        memberId,
        status: "ATTENDING",
        queuedSince: new Date(),
        overriddenById: adminId,
        overriddenAt: new Date(),
      },
    });
  });
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/rsvpAdminOverride.test.ts`
Expected: PASS

---

### Task 2: Server Action `adminOverrideAttendAction`

**Files:**
- Modify: `src/actions/adminActions.ts`
- Test: `tests/admin/adminAttendAction.test.ts`

**Interfaces:**
- Consumes: `adminOverrideAttend` from `@/services/rsvpService`, `getSessionMember` from `@/lib/auth`
- Produces: `adminOverrideAttendAction(teamId: string, memberId: string, adminId: string): Promise<{ success: boolean; error?: string }>`

- [x] **Step 1: Write the failing test**

Create `tests/admin/adminAttendAction.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminOverrideAttendAction } from "../../src/actions/adminActions";
import * as auth from "../../src/lib/auth";
import * as rsvpService from "../../src/services/rsvpService";

vi.mock("../../src/lib/auth");
vi.mock("../../src/services/rsvpService");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("adminOverrideAttendAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Review Focus #4: Non-admin authorization rejection
  it("rejects unauthorized non-admin requests", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({ id: "user-1", role: "USER", name: "User" } as any);

    const result = await adminOverrideAttendAction("team-1", "member-1", "user-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Niet geautoriseerd.");
    expect(rsvpService.adminOverrideAttend).not.toHaveBeenCalled();
  });

  it("allows admin to re-enroll a player", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({ id: "admin-1", role: "ADMIN", name: "Admin" } as any);
    vi.spyOn(rsvpService, "adminOverrideAttend").mockResolvedValue(undefined as any);

    const result = await adminOverrideAttendAction("team-1", "member-1", "admin-1");
    expect(result.success).toBe(true);
    expect(rsvpService.adminOverrideAttend).toHaveBeenCalledWith("team-1", "member-1", "admin-1");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin/adminAttendAction.test.ts`
Expected: FAIL with "adminOverrideAttendAction is not a function"

- [x] **Step 3: Implement `adminOverrideAttendAction` in `src/actions/adminActions.ts`**

Export:
```typescript
export async function adminOverrideAttendAction(
  teamId: string,
  memberId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    await adminOverrideAttend(teamId, memberId, adminId);
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin/adminAttendAction.test.ts`
Expected: PASS

---

### Task 3: UI Presentation in `TeamLineup.tsx`

**Files:**
- Modify: `src/components/TeamLineup.tsx`
- Test: `tests/components/TeamLineupDeclined.test.tsx`

**Interfaces:**
- Consumes: `DeclinedMember` interface: `{ id: string; name: string }`
- Produces: Updated `TeamLineupProps`:
  - `declinedMembers?: DeclinedMember[]`
  - `onAdminOverrideAttend?: (memberId: string) => void`

- [x] **Step 1: Write the failing component test**

Create `tests/components/TeamLineupDeclined.test.tsx`:
```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamLineup } from "../../src/components/TeamLineup";

describe("TeamLineup Declined Players Rendering", () => {
  const dummyAttendees = [
    { id: "1", name: "Alice", queuedSince: new Date(1000) },
  ];

  // Review Focus #5: Zero declined players
  it("does not render the Afgemeld section when declinedMembers is empty or omitted", () => {
    const html = renderToStaticMarkup(
      <TeamLineup attendees={dummyAttendees} maxTeamSize={4} />
    );
    expect(html).not.toContain("Afgemeld");
  });

  it("renders declined member chips with ✕ when declinedMembers are provided", () => {
    const declined = [
      { id: "d1", name: "Bob" },
      { id: "d2", name: "Charlie" },
    ];
    const html = renderToStaticMarkup(
      <TeamLineup attendees={dummyAttendees} maxTeamSize={4} declinedMembers={declined} />
    );
    expect(html).toContain("Afgemeld (2)");
    expect(html).toContain("Bob");
    expect(html).toContain("Charlie");
    expect(html).not.toContain("+ Aanmelden");
  });

  it("renders '+ Aanmelden' buttons on chips when user is admin", () => {
    const declined = [{ id: "d1", name: "Bob" }];
    const html = renderToStaticMarkup(
      <TeamLineup
        attendees={dummyAttendees}
        maxTeamSize={4}
        declinedMembers={declined}
        isAdmin={true}
        onAdminOverrideAttend={() => {}}
      />
    );
    expect(html).toContain("+ Aanmelden");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/TeamLineupDeclined.test.tsx`
Expected: FAIL because `declinedMembers` prop and "Afgemeld" section are not yet present.

- [x] **Step 3: Update `src/components/TeamLineup.tsx`**

1. Define `export interface DeclinedMember { id: string; name: string }`.
2. Add `declinedMembers?: DeclinedMember[]` and `onAdminOverrideAttend?: (memberId: string) => void` to `TeamLineupProps`.
3. Below the reserves list (or below active list if `reserves.length === 0`), render:
```tsx
{declinedMembers && declinedMembers.length > 0 && (
  <div className="mt-3 pt-3 border-t border-slate-100">
    <h4 className="text-xs font-bold text-slate-500 mb-2">
      Afgemeld ({declinedMembers.length})
    </h4>
    <div className="flex flex-wrap gap-1.5">
      {declinedMembers.map((member) => (
        <span
          key={member.id}
          className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200"
        >
          <span className="text-slate-400 font-bold">✕</span>
          <span className="font-medium">{member.name}</span>
          {isAdmin && onAdminOverrideAttend && (
            <button
              type="button"
              onClick={() => onAdminOverrideAttend(member.id)}
              className="ml-1 text-[10px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-1.5 py-0.5 rounded-full transition-colors"
              title="Meld deze speler aan"
            >
              + Aanmelden
            </button>
          )}
        </span>
      ))}
    </div>
  </div>
)}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/TeamLineupDeclined.test.tsx`
Expected: PASS

---

### Task 4: Client State Integration in `QuizDetailClient.tsx`

**Files:**
- Modify: `src/components/QuizDetailClient.tsx`
- Test: `tests/components/QuizDetailDeclined.test.tsx`

**Interfaces:**
- Consumes: `TeamLineup` with `declinedMembers`, `adminOverrideAttendAction`, `adminOverrideDeclineAction`, `joinQuizRsvpAction`, `declineQuizRsvpAction`
- Produces: Optimistic management of `declinedMembers` state alongside `attendees`.

- [x] **Step 1: Write component tests for `QuizDetailClient` initial declined rendering**

Create `tests/components/QuizDetailDeclined.test.tsx`:
```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { CapabilitiesProvider } from "../../src/features/capabilities";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("QuizDetailClient Declined Players Integration", () => {
  const quizWithDeclined = {
    id: "quiz-1",
    title: "Pubquiz",
    startsAt: new Date("2026-11-20T20:00:00Z"),
    location: "Gent",
    durationMinutes: 180,
    entryFee: null,
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [
        { memberId: "m1", status: "ATTENDING", queuedSince: new Date(1000), member: { id: "m1", name: "Attending Alice" } },
        { memberId: "m2", status: "DECLINED", queuedSince: null, member: { id: "m2", name: "Declined Dave" } },
      ],
    },
  };

  const defaultCaps = { vision: false, icalExport: false, whatsappShare: false, emailRegistration: false };

  it("initializes and renders declined members from quiz team data", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient quiz={quizWithDeclined} currentMemberId="m1" currentMemberName="Attending Alice" />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Attending Alice");
    expect(html).toContain("Afgemeld (1)");
    expect(html).toContain("Declined Dave");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/QuizDetailDeclined.test.tsx`
Expected: FAIL because `QuizDetailClient` does not pass `declinedMembers` to `TeamLineup`.

- [x] **Step 3: Update `src/components/QuizDetailClient.tsx`**

1. Parse initial declined list:
```typescript
const initialDeclined: DeclinedMember[] = (team?.rsvps || [])
  .filter((r: any) => r.status === "DECLINED")
  .map((r: any) => ({
    id: r.memberId,
    name: r.member?.name || "Lid",
  }));
```
2. Add state: `const [declinedMembers, setDeclinedMembers] = useState<DeclinedMember[]>(initialDeclined);`
3. Update `handleRsvpChange`:
   - When `status === "ATTENDING"`:
     - Remove from `declinedMembers`: `setDeclinedMembers((prev) => prev.filter((d) => d.id !== currentMemberId));`
     - Add to `attendees` (if not already present).
     - Call `joinQuizRsvpAction(team.id, currentMemberId)`.
   - When `status === "DECLINED"`:
     - Remove from `attendees`: `setAttendees((prev) => prev.filter((a) => a.id !== currentMemberId));`
     - Add to `declinedMembers` (if not already present): `setDeclinedMembers((prev) => [...prev.filter((d) => d.id !== currentMemberId), { id: currentMemberId, name: `${currentMemberName} (jij)` }]);`
     - Call `declineQuizRsvpAction(team.id, currentMemberId)`.
4. Update `handleAdminOverrideDecline`:
   - Find member name from `attendees`.
   - Remove from `attendees`.
   - Add to `declinedMembers`.
   - Call `adminOverrideDeclineAction(team.id, memberId, currentMemberId)`.
5. Add `handleAdminOverrideAttend`:
```typescript
const handleAdminOverrideAttend = async (memberId: string) => {
  const memberToEnroll = declinedMembers.find((d) => d.id === memberId);
  const memberName = memberToEnroll?.name || "Lid";

  setDeclinedMembers((prev) => prev.filter((d) => d.id !== memberId));
  setAttendees((prev) => [
    ...prev.filter((a) => a.id !== memberId),
    { id: memberId, name: memberName, queuedSince: new Date() },
  ]);

  await adminOverrideAttendAction(team.id, memberId, currentMemberId);
};
```
6. Pass `declinedMembers={declinedMembers}` and `onAdminOverrideAttend={handleAdminOverrideAttend}` into `<TeamLineup />`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/QuizDetailDeclined.test.tsx`
Expected: PASS

---

### Task 5: Full Suite Verification & Documentation

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run complete Vitest suite**

Run: `npm test`
Expected: All tests pass (including new tests from Tasks 1-4).

- [ ] **Step 2: Run build check**

Run: `npm run build`
Expected: Build succeeds with zero TypeScript or bundling errors.

- [ ] **Step 3: Update `docs/roadmap.md`**

Mark Item 3 as completed and cross-link both the design spec and the implementation plan.
