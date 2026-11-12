# Design Document: Admin Role Management (Promote / Demote)

- **Date:** 2026-11-11
- **Status:** Approved / Ready for Implementation Plan
- **Target App Version:** `v2.4.0`
- **Roadmap Item:** Part 2, Item C9 (`docs/roadmap.md`)

---

## 1. Intent & The Why

In **be-quiz**, administrators manage quiz logistics, lineups, and team settings. Currently, a member's role (`USER` or `ADMIN`) is assigned at invite creation and cannot be changed without direct PostgreSQL database intervention.

When team responsibilities change (e.g. an additional friend steps up to coordinate quizzes, or an admin steps back to regular player status), administrators need the ability to promote members to `ADMIN` or demote admins back to `USER` directly within `/admin/members`.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **Clear Partitioned Overview:** Separate the member roster in `/admin/members` into two distinct groups: **Beheerders** (`ADMIN`) and **Leden** (`USER`), mirroring the partitioned lineup design of the quiz player lists.
- **Controlled Role Transfers:** Provide intuitive transfer buttons on each member row (`↑ Maak Beheerder` / `↓ Naar Leden`).
- **Confirmation Safety:** Protect against accidental touches or clicks on mobile by gating transfers behind the existing `ConfirmDialog` modal.
- **Strict Server-Side Guardrails:**
  - Prevent self-demotion (an admin cannot demote their own active account).
  - Prevent last-admin demotion (at least one administrator must remain at all times, guarded transactionally against concurrency).
  - Strictly enforce that only active `ADMIN` sessions can invoke the role change action.
- **Immediate State Consistency:** Update client state cleanly using pure state derivations without page reloads.

### Non-Goals

- Adding granular permission scopes (e.g. "editor", "moderator"). The domain model strictly uses `Role` (`USER` | `ADMIN`).
- Drag-and-drop between sections on touchscreens (avoids mobile touch/scroll conflicts and snap-back complexity).

### Anti-Goals

- Allowing an admin to accidentally revoke their own access and lock themselves out.
- Allowing all admins to be demoted, creating an orphaned team without administrative control.
- Silent 1-tap role changes without confirmation.

---

## 3. Constraints & Architectural Invariants

- **Single Source of Truth (Invariant 6):** `MemberRosterClient` must manage a single unified list of members in state and derive the `admins` and `users` sub-lists purely via filtering.
- **Service Layer Isolation (Invariant 1):** Domain business rules, transactional guarantees, and database queries live in `src/services/memberService.ts`. Server actions in `src/actions/adminActions.ts` act solely as controller adaptors handling authentication and HTTP cache revalidation.
- **Node-based Deterministic Testing (Invariant 7):** Domain services, server actions, and UI reducers/static markup must be verified in Node.js Vitest without reliance on brittle browser DOM emulation (`jsdom`).
- **Reusable Components:** Reuse `ConfirmDialog` (`src/components/ConfirmDialog.tsx`) for transfer confirmations.

---

## 4. Approaches Considered

### Approach 1: Partitioned Sections with Transfer Buttons & `ConfirmDialog` (Selected)

- **Description:** Split `/admin/members` into **Beheerders** and **Leden** cards. Each member has an action button (`↑ Maak Beheerder` or `↓ Naar Leden`) that triggers `ConfirmDialog`.
- **Trade-offs:** Highly visual and mobile-friendly; eliminates accidental taps; mirrors existing quiz lineup UX patterns.
- **Reason Selected:** Approved by user during visual mockup review as the most natural, ergonomic, and safe design.

### Approach 2: Inline Action Buttons in a Single Flat List

- **Description:** Keep a single list of all members with role badges and an inline "Promote"/"Demote" button.
- **Trade-offs:** Less visually distinct hierarchy; requires scanning badges across all rows.
- **Reason Rejected:** Less clear at a glance than partitioned cards.

### Approach 3: Drag-and-Drop between Sections

- **Description:** Dragging cards between "Beheerders" and "Leden" to transfer roles.
- **Trade-offs:** Tactile on desktop, but prone to touch-scroll conflicts and finicky drops on mobile devices; complex snap-back behavior when dialog is cancelled.
- **Reason Rejected:** Unfavorable ergonomics for mobile-first team members.

---

## 5. Detailed Design & Architecture

### 5.1 Domain Service: `src/services/memberService.ts`

Encapsulates business rules and transactional integrity:

```typescript
export async function updateMemberRole(
  targetMemberId: string,
  newRole: "USER" | "ADMIN",
  actorId: string
): Promise<Member>;
```

**Transactional Pipeline (`prisma.$transaction`):**

1. Check self-demotion: If `targetMemberId === actorId` and `newRole === "USER"`, reject with:
   - Error: `"Je kunt je eigen beheerder-rol niet intrekken."`
2. Fetch target member within transaction:
   - If target does not exist, throw `"Lid niet gevonden."`
3. Idempotency check: If `targetMember.role === newRole`, return early without modifications.
4. Concurrency & Last-Admin Check:
   - If `targetMember.role === "ADMIN"` and `newRole === "USER"`:
     - Count current administrators:
       ```typescript
       const adminCount = await tx.member.count({ where: { role: "ADMIN" } });
       if (adminCount <= 1) {
         throw new Error("Er moet minstens één beheerder overblijven.");
       }
       ```
5. Execute atomic update:
   ```typescript
   return tx.member.update({
     where: { id: targetMemberId },
     data: { role: newRole },
   });
   ```

---

### 5.2 Server Action: `adminUpdateMemberRoleAction`

Located in `src/actions/adminActions.ts`:

```typescript
export async function adminUpdateMemberRoleAction(
  memberId: string,
  newRole: "USER" | "ADMIN"
): Promise<{ success: boolean; error?: string }>;
```

**Controller Pipeline:**

1. Authenticate caller session via `getSessionMember()`.
2. Enforce caller authorization: `currentMember?.role === "ADMIN"`. If unauthorized, return `{ success: false, error: "Niet geautoriseerd." }`.
3. Invoke `updateMemberRole(memberId, newRole, currentMember.id)`.
4. Trigger cache revalidation:
   ```typescript
   try {
     revalidatePath("/admin/members");
   } catch {}
   ```
5. Return `{ success: true }` (or catch and return `{ success: false, error: err.message }`).

---

### 5.3 Server Component: `src/app/admin/members/page.tsx`

- Ensure `currentMember` is loaded (already checked for `ADMIN` role).
- Pass `currentMemberId={currentMember.id}` to `MemberRosterClient`.

---

### 5.4 Client Component: `src/components/MemberRosterClient.tsx`

- **Props:**
  ```typescript
  interface MemberRosterClientProps {
    initialMembers: Member[];
    currentMemberId: string;
  }
  ```
- **State:** Maintains unified `members` array.
- **Derived State:**
  ```typescript
  const admins = members.filter((m) => m.role === "ADMIN");
  const regularMembers = members.filter((m) => m.role === "USER");
  ```
- **Dialog & In-Flight State:**
  - `selectedRoleChange: { member: Member; targetRole: "USER" | "ADMIN" } | null`
  - `isSubmittingRole: boolean` (prevents double submissions while server action is in flight)
- **Visual Display:**
  - **Beheerders Card:**
    - Header with shield icon, count (`admins.length`), and subtitle.
    - Each admin row displays member name and `Reset PIN` button.
    - If `m.id === currentMemberId`: displays `(Jij)` badge, no demote button.
    - If `m.id !== currentMemberId`: displays `↓ Naar Leden` transfer button.
      _(Note: Because the active viewer is an admin, any other admin row means `admins.length >= 2`, so demoting them will always leave $\ge 1$ admin. No redundant client-side disabled state is needed)._
  - **Leden Card:**
    - Header with users icon, count (`regularMembers.length`), and subtitle.
    - Each member row shows name, `↑ Maak Beheerder` transfer button, and `Reset PIN` button.
- **Confirmation Flow (`ConfirmDialog`):**
  - Clicking `↑ Maak Beheerder` sets `selectedRoleChange` with targetRole `"ADMIN"`.
    - `title`: `"[Naam] promoveren naar Beheerder?"`
    - `message`: `"[Naam] krijgt volledige rechten om quizzen toe te voegen, details te bewerken, teaminschrijvingen te wijzigen en vrienden te beheren."`
    - `confirmLabel`: `"Ja, Maak Beheerder"`
    - `isDestructive`: `false`
  - Clicking `↓ Naar Leden` sets `selectedRoleChange` with targetRole `"USER"`.
    - `title`: `"[Naam] degraderen naar Lid?"`
    - `message`: `"[Naam] verliest beheerderstoegang en wordt een gewone speler."`
    - `confirmLabel`: `"Ja, Maak Lid"`
    - `isDestructive`: `true`
  - **Execution on Confirm:**
    - Sets `isSubmittingRole = true`.
    - Awaits `adminUpdateMemberRoleAction(targetMember.id, targetRole)`.
    - On success: updates `members` state immutably (`setMembers(prev => prev.map(...))`) and clears dialog state.
    - On failure: displays error alert and resets submitting state.

---

## 6. Verification & Testing Strategy

- **Unit / Integration Tests in `tests/services/memberService.test.ts` (Node.js Vitest):**
  - Rejection of self-demotion (`actorId === targetMemberId`).
  - Rejection of demoting the sole administrator (`adminCount <= 1`).
  - Idempotent handling when target is already in the requested role.
  - Successful promotion of a regular member to admin.
  - Successful demotion of an admin when other admins remain.
  - Transactional rollback on error.
- **Server Action Tests in `tests/admin/adminMemberRoleAction.test.ts`:**
  - Non-admin authorization rejection (`403 / Niet geautoriseerd`).
  - Successful execution and path revalidation.
- **Static UI Verification in `tests/ui/memberRoster.test.ts`:**
  - Verify static markup contains partitioned Beheerders and Leden cards.
  - Verify `(Jij)` badge renders for `currentMemberId` without a demote button.
  - Verify transfer buttons render appropriately for other roster members.
