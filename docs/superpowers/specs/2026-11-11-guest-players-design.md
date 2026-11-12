# Design Specification: Guest Players

**Date:** 2026-11-11  
**Topic:** Teams & Headcount — Support for External Guest Players on Quiz Lineups (Roadmap Item B5 / v2 Backlog)  
**Status:** Approved

---

## 1. Intent & The Why

In a pub quiz team, regular members with registered accounts and PINs form the core team. However, on various quiz nights, a teammate may want to bring a partner, friend, or substitute player to fill a table (e.g. "Sarah is joining with Alice", or Alice cannot attend but arranges for Sarah to substitute).

Previously, the app strictly required an RSVP to belong to a registered `Member` with an active account and PIN. Forcing occasional or one-time guests to register an account, set a 4-digit PIN, and remember credentials adds friction and clutters the member directory.

The **Guest Players** feature allows any authenticated team member (or admin) to add external guests by name to a quiz lineup. Guests take up a slot under the exact same first-come, first-served (FIFO) queueing rules as registered members, are clearly badged in the lineup, and can be removed by the teammate who invited them or by an Admin.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals

- **Unrestricted Guest Addition by Any Member:** Any authenticated team member or admin can add an external guest player by name to a quiz lineup.
- **Decoupled Attendance & Substitute Support:** Guests are decoupled from their inviter's attendance status. A member can invite a guest even if they themselves cannot attend (acting as a team substitute). If an inviter changes their own RSVP to `DECLINED`, their invited guests remain in the lineup/waitlist undisturbed.
- **Fair FIFO Queueing & Shared Capacity:** Guests occupy team slots identically to regular members. If capacity (`maxTeamSize`) is open, the guest enters the active team lineup. If the team is full, the guest enters the reserve/waitlist queue in chronological order (`queuedSince`). If an active player drops out, waitlisted players (whether members or guests) advance in FIFO order.
- **Multiple Guests Allowed:** A member can invite as many guests as needed without an arbitrary per-member cap.
- **Clear Attribution & Badging:** The UI, lineup roster, and exports clearly designate guest players with their name and inviter (e.g., _"Sarah (Gast van Alice)"_).
- **Granular Removal Permissions:**
  - The member who added the guest can remove that guest at any time.
  - Administrators can remove any guest at any time.
  - Other regular members cannot remove another teammate's guest.
- **Permanent Deletion Semantics:** When a guest is removed, their `Rsvp` record is deleted from the database. Guests do not linger in the "Afgemeld" section.
- **Lockdown Adherence:** Follows quiz lockdown rules: when a quiz has started (`now >= startsAt`), non-admins cannot add or remove guests, while admins retain full override capability.
- **Single Source of Truth:** Guests are modeled directly within the existing `Rsvp` collection to prevent parallel state arrays or split queue logic.

### 2.2 Non-Goals

- **Guest Account Creation / Authentication:** Guests do not receive PINs, sessions, or login capabilities. They cannot log in or submit RSVPs themselves.
- **Post-Quiz Rating by Guests:** Only registered attending members can submit ratings in completed quizzes.
- **Global Guest Directory:** Guests are event-scoped lineup entries, not permanent members added to `/admin/members`.

### 2.3 Anti-Goals

- **Separate Parallel Guest Collections:** Never introduce a separate `GuestRsvp` or `GuestPlayer` database table or parallel client state array that requires manual merging, sorting, and multi-table synchronization.
- **Special Queue Precedence:** Guests do not have lower or higher queue priority than registered members; queueing is strictly chronological (FIFO) by timestamp.

---

## 3. Architecture & Data Model

### 3.1 Schema Adjustments (`prisma/schema.prisma`)

We update the existing `Rsvp` model to support both member RSVPs and guest RSVPs within the single unified collection:

```prisma
model Rsvp {
  id             String     @id @default(cuid())
  teamId         String
  team           Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)

  // Nullable member link (null for guest entries)
  memberId       String?
  member         Member?    @relation(fields: [memberId], references: [id], onDelete: Restrict)

  // Guest fields
  guestName      String?    // e.g. "Sarah"
  invitedById    String?    // FK to Member who added the guest
  invitedBy      Member?    @relation("GuestInviter", fields: [invitedById], references: [id], onDelete: Restrict)

  status         RsvpStatus // ATTENDING | DECLINED
  queuedSince    DateTime?  // Timestamp determining position in line

  // Admin audit / overrides
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

In `Member` model, add the reverse relation:

```prisma
guestRsvps  Rsvp[]  @relation("GuestInviter")
```

### 3.2 Invariants & Validation Rules

1. **Rsvp Polymorphism Constraint:**
   - Either `memberId` is present (registered member RSVP).
   - OR `guestName` is non-empty and `invitedById` is present (guest RSVP).
2. **Name Sanitization:** `guestName` must be trimmed, between 1 and 50 characters, and stripped of excess whitespace.
3. **Per-Member Name Collision Prevention:** An inviter cannot add two guests with the exact same case-insensitive name to the same team (e.g. Alice cannot add two "Sarah"s, but Alice and Bob can each bring a "Sarah").
4. **Guest Removal Semantics:** When a guest is removed, the `Rsvp` row is deleted directly from the database (`DELETE FROM Rsvp WHERE id = ...`), naturally triggering queue advancement for any following waitlisted players.
5. **Decoupled Lifetime:** When an inviter toggles their own RSVP to `DECLINED`, their guests remain `ATTENDING` in their current active or waitlisted queue position.

---

## 4. Evaluated Approaches

### Approach 1: Unified `Rsvp` Collection with Polymorphic Fields (Selected)

- **Design:** Keep `Rsvp` as the single source of truth for all lineup positions. Make `memberId` optional, add `guestName` and `invitedById`.
- **Trade-offs:** Requires schema migration for optional `memberId`.
- **Why Chosen:** 100% adherence to Single Source of Truth invariant. Existing FIFO queueing algorithms, waitlist calculations, and drag-and-drop reordering work out of the box without parallel state or dual-table joins.

### Approach 2: Separate `GuestPlayer` Table

- **Design:** Standalone table storing guest entries.
- **Why Rejected:** Violates single-source-of-truth invariant. Requires merging and sorting two disconnected database tables in application code, complicating transactions and waitlist promotions.

### Approach 3: Ephemeral Records in `Member` Table

- **Design:** Create dummy `Member` rows with `role: GUEST` and `pinHash: null`.
- **Why Rejected:** Pollutes the core member roster with temporary records, complicating member management and analytics.

---

## 5. Domain Services & Server Actions

### 5.1 Service Layer: `src/services/rsvpService.ts` & `src/services/quizService.ts`

1. **`addGuestRsvp(teamId: string, guestName: string, invitedById: string)`**:
   - Acquires row lock on `Team` via transaction (`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`).
   - Validates `guestName` length (1-50 chars after trim).
   - Checks if this inviter already added a guest with the same case-insensitive name on this team.
   - Inserts new `Rsvp` record with:
     - `teamId`, `guestName: trimmedName`, `invitedById`
     - `status: "ATTENDING"`
     - `queuedSince: new Date()`
   - Emits `team.roster_changed` domain event.
   - Returns the created `Rsvp` record with `invitedBy` relation included.
2. **`removeGuestRsvp(rsvpId: string, actorId: string, actorRole: string)`**:
   - Fetches target `Rsvp`.
   - Validates that `rsvp.guestName` is not null (is a guest).
   - Enforces permissions: throws `Forbidden` unless `actorRole === 'ADMIN' || rsvp.invitedById === actorId`.
   - Deletes the `Rsvp` record inside a transaction with `Team` lock.
   - Emits `team.roster_changed` domain event.
3. **`getRsvpLineup(teamId: string)`**:
   - Queries `prisma.rsvp.findMany` with `include: { member: true, invitedBy: true }`.
   - Partitions into `active` and `reserves` based on `team.maxTeamSize`.
   - Returns unified list where items contain member info or guest info.
4. **`getQuizById(id: string)` in `src/services/quizService.ts`**:
   - Update `team.rsvps` relation query to include `invitedBy: true` alongside `member: true`:
     ```ts
     rsvps: {
       include: {
         member: true,
         invitedBy: true,
       },
       orderBy: {
         queuedSince: "asc",
       },
     }
     ```
5. **Downstream Event Handler Null-Safety (`src/features/calendar/shared/subscriber.ts`)**:
   - When `team.roster_changed` is emitted, calendar event handlers format the active lineup. Because guests have `member: null`, `r.member.name` throws an unhandled `TypeError`.
   - Update lineup name mapping to be null-safe:
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
6. **Rating Eligibility Protection (`src/services/ratingService.ts`)**:
   - In `getQuizRatingSummary`, `submitQuizRating`, and `getUserRatingEligibility`, `activeMemberIds` is mapped from active RSVPs. For guests, `r.memberId` is `null`.
   - Filter out null member IDs to prevent inflating `totalEligible` in `computeRatingSummary` with non-voting guests:
     ```ts
     const activeMemberIds = (quiz.team?.rsvps || [])
       .slice(0, maxTeamSize)
       .map((r) => r.memberId)
       .filter((id): id is string => Boolean(id));
     ```
7. **Dashboard Roster Labeling (`src/components/QuizzesDashboard.tsx`)**:
   - Update `quiz.team.rsvps` mapping in `QuizzesDashboard.tsx` to handle guest display names cleanly:
     ```ts
     memberName: r.member?.name || r.guestName || "Gast";
     ```

### 5.2 Server Actions: `src/actions/rsvpActions.ts`

- **`addGuestAction(teamId: string, guestName: string)`**:
  - Authenticates session member via `getSessionMember()` (from `@/lib/auth`).
  - Verifies lockdown status (`startsAt <= new Date()`, unless admin).
  - Calls `rsvpService.addGuestRsvp(teamId, guestName, sessionMember.id)`.
  - Revalidates path `/quizzes/[id]`.
  - Returns `{ success: true, rsvp: { id: string, guestName: string, invitedById: string, invitedByName: string, queuedSince: Date } }` (or `{ success: false, error: string }`).
- **`removeGuestAction(rsvpId: string, teamId: string)`**:
  - Authenticates session member via `getSessionMember()`.
  - Verifies lockdown status (unless admin).
  - Calls `rsvpService.removeGuestRsvp(rsvpId, sessionMember.id, sessionMember.role)`.
  - Revalidates path `/quizzes/[id]`.
  - Returns `{ success: true }` (or `{ success: false, error: string }`).

---

## 6. Client State & User Interface

### 6.1 Unified Client State (`src/lib/rsvpReducer.ts`)

Update `ClientRsvp` type (note: `id` is mandatory to guarantee unique keys across members and guests):

```ts
export interface ClientRsvp {
  id: string; // Rsvp cuid (authoritative identifier for deletions, reordering, and keys)
  memberId?: string | null;
  guestName?: string | null;
  invitedById?: string | null;
  invitedByName?: string | null;
  name: string; // e.g. "Sarah" (guests) or "Alice" (members)
  isGuest: boolean;
  status: "ATTENDING" | "DECLINED";
  queuedSince: Date | null;
}
```

Update `RsvpAction`:

```ts
export type RsvpAction =
  | { type: "USER_RSVP"; memberId: string; name: string; status: "ATTENDING" | "DECLINED" }
  | { type: "ADD_GUEST"; id: string; guestName: string; invitedById: string; invitedByName: string }
  | { type: "REMOVE_GUEST"; id: string }
  | { type: "ADMIN_OVERRIDE_DECLINE"; memberId: string }
  | { type: "ADMIN_OVERRIDE_ATTEND"; memberId: string }
  | { type: "ADMIN_REORDER"; sourceIndex: number; destinationIndex: number };
```

**Keying Invariant for Reordering & Identifier Invariant:**

- `ADMIN_REORDER` must map reordered timestamps using unique key `r.id ?? r.memberId` instead of `r.memberId`. Because guests have `memberId = null`, indexing by `memberId` would cause all guest timestamps to collide on the same map entry.
- When `USER_RSVP` appends a brand-new entry to client state for a member RSVPing for the first time, it sets `id: action.memberId` so `ClientRsvp.id` is guaranteed non-empty.

### 6.2 Lineup Component (`src/components/TeamLineup.tsx`)

Update `LineupMember` and `TeamLineupProps` interfaces:

```ts
export interface LineupMember {
  id: string; // Unique row key (rsvp.id ?? memberId)
  rsvpId?: string;
  memberId?: string | null;
  name: string;
  isGuest?: boolean;
  guestName?: string | null;
  invitedById?: string | null;
  invitedByName?: string | null;
  queuedSince: Date;
}

export interface TeamLineupProps {
  attendees: LineupMember[];
  declinedMembers?: DeclinedMember[];
  maxTeamSize: number;
  isAdmin?: boolean;
  currentMemberId?: string;
  onAdminOverrideDecline?: (memberId: string) => void;
  onAdminOverrideAttend?: (memberId: string) => void;
  onRemoveGuest?: (rsvpId: string) => void;
  onReorder?: (sourceIndex: number, destinationIndex: number) => Promise<void> | void;
}
```

- Each active or reserve slot displays:
  - If member: regular member name (with `(jij)` indicator for current user).
  - If guest: `[guestName]` with guest badge: `<span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-medium">Gast van [invitedByName]</span>`.
- Removal button & Action Handlers:
  - For regular members: Admin sees "Afzeggen" override, which MUST pass `member.memberId!` (e.g. `onAdminOverrideDecline(member.memberId!)`) so the backend receives the valid member ID rather than the RSVP CUID.
  - For guests: If `currentMemberId === member.invitedById || isAdmin`, displays a "Verwijderen" (Remove) button that triggers `onRemoveGuest(member.rsvpId || member.id)` using the RSVP CUID.
- User Index Lookup in `QuizDetailClient.tsx`:
  - `currentUserIndex` lookup must check `attendees.findIndex((a) => a.memberId === currentMemberId)` instead of `a.id === currentMemberId`, ensuring current user position, reserve status, and eligibility are correctly computed when `a.id` contains the RSVP CUID.
- Reordering:
  - Admins can drag-and-drop reorder both member and guest slots seamlessly using the existing grab handles.

### 6.3 Guest Entry UI (`QuizDetailClient.tsx` / `AddGuestDialog.tsx`)

- Directly below or alongside the RSVP action buttons ("Ik doe mee" / "Ik pas"), display an "+ Gast toevoegen" button.
- Clicking opens a clean, compact popover / dialog:
  - Input field: "Naam gastspeler" (placeholder e.g. "Sarah").
  - "Toevoegen" submit button.
  - Quick validation and instant feedback.

---

## 7. Security, Edge Cases & Permissions

1. **Self-Invited Guest Removal Only:**
   - Validated on both client (hiding remove button) and server action / domain service (authoritative check throwing `ForbiddenError`).
2. **Lockdown Protection:**
   - Once `startsAt` has passed, regular members cannot add or remove guests. Admins retain override access.
   - _Sequencing note:_ Quiz Start Lockdown (Roadmap item 8) is specified in `docs/superpowers/specs/2026-11-08-quiz-start-lockdown-design.md`. Guest player server actions verify `startsAt <= new Date()` (via a lightweight helper or `quizLock.ts`) to maintain complete forward-compatibility with item 8.
3. **Deleted Inviter:**
   - Database foreign key `onDelete: Restrict` prevents accidental member deletion if they have active guest RSVPs.
4. **Concurrency & Race Conditions:**
   - `SELECT ... FOR UPDATE` on `Team` serializes simultaneous guest additions and member RSVPs, preventing race conditions around `maxTeamSize` and waitlist timestamps.

---

## 8. Deterministic Testing Strategy

1. **Unit Tests (`tests/lib/rsvpReducer.test.ts`):**
   - Test adding guest action (`ADD_GUEST`) to state.
   - Test removing guest action (`REMOVE_GUEST`) from state.
   - Test reordering (`ADMIN_REORDER`) with multiple guest players ensuring timestamps do not collide.
   - Verify `deriveLineupRosters` correctly positions guests in active vs reserve based on `queuedSince`.
   - Verify `USER_RSVP` generates clean non-empty IDs for new entries.
2. **Domain Service & Subscriber Tests (`tests/services/guestRsvpService.test.ts`):**
   - Add guest to empty team -> guest is in `active`.
   - Add guest to full team -> guest is in `reserves`.
   - Member leaves full team -> guest in reserve is promoted to active.
   - Non-inviter non-admin attempts to remove guest -> throws Forbidden error.
   - Inviter removes guest -> guest is deleted and next reserve is promoted.
   - Admin removes guest -> succeeds.
   - Adding guest when inviter is declined -> succeeds and guest is placed in lineup.
   - Inviter declines after adding guest -> guest remains in lineup undisturbed.
   - Verify `ratingService.ts` excludes guest RSVPs when calculating `totalEligible`.
   - Verify calendar subscriber handles `team.roster_changed` with guest players safely without throwing null pointer exceptions.
3. **Component Tests (`tests/components/TeamLineupGuests.test.tsx`):**
   - Executed under Node environment (`vitest.config.ts`) using `renderToStaticMarkup` from `react-dom/server` without browser DOM emulation.
   - Verify rendering of guest chips with `Gast van [invitedByName]`.
   - Verify rendering of "Verwijderen" button for inviter and admin.
   - Verify omission of "Verwijderen" button for unrelated members.
4. **Lockdown Tests:**
   - Adding/removing guest when quiz is past `startsAt` fails for regular users and succeeds for admins.
