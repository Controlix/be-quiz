# Declined Players Visibility & Admin Re-enroll Design Specification

- **Date:** 2026-10-31
- **Status:** Draft / Pending Approval
- **Roadmap Item:** Part 1, Item 3: Declined Players Visibility ("Afgemeld")
- **Authors:** AI Agent & Project Owner

---

## 1. Intent & The Why

When teammates decline an invite or RSVP (*"Ik pas"*), they currently disappear completely from the quiz detail view. This creates confusion among team members, who cannot tell whether someone has not yet seen the quiz or has explicitly declined, leading to unnecessary manual coordination in WhatsApp.

Making declined members visible directly inside the quiz lineup card gives immediate clarity. In addition, providing an admin re-enroll action creates functional symmetry with the existing admin decline override ("Afzeggen"), enabling admins to quickly fix mistakes or re-add players who accepted verbally/offline.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Full Transparency:** Display all members who explicitly declined (*"Ik pas"*) on the quiz details view.
- **Unified Card UI:** Render declined players in a clean, always-visible section at the bottom of `TeamLineup` using compact muted chips.
- **Adaptive Display:** If no members have declined, keep the section hidden to save vertical space.
- **Symmetric Admin Control:** Allow admins to re-enroll a declined player with a single tap (`+ Aanmelden`), automatically assigning them to the active roster or reserve queue based on team capacity.
- **Instant Optimistic Feedback:** Update the active roster and declined chips immediately on the client when players RSVP or admins trigger overrides.
- **Drag-and-Drop Integrity:** Keep drag-and-drop reordering strictly isolated to attending players (`active` + `reserves`).

### Non-Goals
- Showing declined chips on the main `/quizzes` dashboard cards (keeps list cards lean).
- Supporting drag-and-drop from the lineup directly into the declined section (button actions are far more explicit, accessible, and thumb-friendly).

### Anti-Goals
- **No Database Migrations:** Re-use the existing Prisma schema (`status: DECLINED`, `overriddenById`, and `overriddenAt` on `Rsvp`).
- **No FIFO Violations:** Re-enrolling a player places them at the current timestamp (`queuedSince: new Date()`), preserving fair queuing for existing players and reserves.

---

## 3. Approaches Considered & Decision

### Approach 1: Integrated into `TeamLineup` Bottom Section (Selected)
- **Design:** Place an "Afgemeld" section at the bottom of the existing `TeamLineup` container, separated by a subtle divider.
- **Rendering:** Compact, muted horizontal chips (e.g. `bg-slate-100 text-slate-600 border border-slate-200`). For admins, each chip includes a `+ Aanmelden` button.
- **Why Selected:** Groups all roster statuses into a single card without creating vertical clutter or extra card borders on mobile.

### Approach 2: Standalone Card Below `TeamLineup` (Rejected)
- **Why Rejected:** Introduces fragmented card borders and padding, pushing the primary action toolbar further down the mobile screen.

### Approach 3: Unified Single List with Status Badges (Rejected)
- **Why Rejected:** Intermingles non-attending members with active players, complicating at-a-glance headcount and interfering with admin drag-and-drop index calculations.

---

## 4. Technical Architecture & Implementation

### 4.1 Data Types (`src/components/TeamLineup.tsx`)
```typescript
export interface DeclinedMember {
  id: string;
  name: string;
}

interface TeamLineupProps {
  attendees: LineupMember[];
  declinedMembers?: DeclinedMember[];
  maxTeamSize: number;
  isAdmin?: boolean;
  onAdminOverrideDecline?: (memberId: string) => void;
  onAdminOverrideAttend?: (memberId: string) => void;
  onReorder?: (sourceIndex: number, destinationIndex: number) => Promise<void> | void;
}
```

### 4.2 Service Layer (`src/services/rsvpService.ts`)
Add `adminOverrideAttend`:
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
        teamId_memberId: { teamId, memberId },
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

### 4.3 Server Actions (`src/actions/adminActions.ts`)
Add `adminOverrideAttendAction`:
- Verifies session member has `role === "ADMIN"`.
- Executes `adminOverrideAttend(teamId, memberId, currentMember.id)`.
- Calls `revalidatePath("/quizzes")`.
- Returns `{ success: true }` or `{ success: false, error }`.

### 4.4 Component Updates

#### A. `TeamLineup.tsx`
- Below the reserves section (or active list if no reserves), render the "Afgemeld" section when `declinedMembers.length > 0`:
```tsx
{declinedMembers.length > 0 && (
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

#### B. `QuizDetailClient.tsx`
- Initialize `declinedMembers` from `team.rsvps.filter(r => r.status === "DECLINED")`.
- Maintain `declinedMembers` state:
  - **Player RSVPs "ATTENDING":** Remove from `declinedMembers`, add to `attendees`.
  - **Player RSVPs "DECLINED":** Remove from `attendees`, add to `declinedMembers`.
  - **Admin overrides decline:** Move target member from `attendees` to `declinedMembers`.
  - **Admin overrides attend:** Move target member from `declinedMembers` to `attendees` with `queuedSince = new Date()`, then call `adminOverrideAttendAction`.

---

## 5. Verification & Test Plan

1. **Unit Tests (`tests/services/rsvpService.test.ts`):**
   - Verify `adminOverrideAttend` switches a declined RSVP to `ATTENDING`, sets `queuedSince` to a valid timestamp, and records `overriddenById` and `overriddenAt`.
   - Verify an un-RSVP'd member is correctly upserted directly into `ATTENDING`.
2. **Server Action Tests (`tests/actions/adminActions.test.ts`):**
   - Verify unauthorized non-admin gets `{ success: false, error: "Niet geautoriseerd." }`.
   - Verify authorized admin successfully triggers `adminOverrideAttendAction`.
3. **Component Tests (`tests/components/TeamLineup.test.tsx`):**
   - Verify declined section does not render when `declinedMembers` is empty.
   - Verify chips render with member names and `✕` indicator when present.
   - Verify "+ Aanmelden" button is only rendered when `isAdmin={true}` and `onAdminOverrideAttend` is provided.
   - Verify clicking "+ Aanmelden" calls `onAdminOverrideAttend(member.id)`.
4. **Integration Flow Test (`tests/components/QuizDetailClient.test.tsx`):**
   - Verify toggling between *"Ik doe mee"* and *"Ik pas"* updates both lists instantly without page reload.
   - Verify admin override decline and attend actions correctly update the lineup and declined chips.
5. **Full Test Suite & Build Verification:**
   - Run `npm test` and `npm run build` to ensure zero regressions across the codebase.
