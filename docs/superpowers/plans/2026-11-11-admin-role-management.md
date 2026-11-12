# Admin Role Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable team administrators to promote members to `ADMIN` and demote admins back to `USER` via a partitioned UI in `/admin/members` with confirmation modals, self-demotion protection, and last-admin database safeguards.

**Architecture:** A domain service `src/services/memberService.ts` executes atomic role updates inside `prisma.$transaction`, enforcing self-demotion and last-admin constraints. A controller server action `adminUpdateMemberRoleAction` validates active session authorization and revalidates cache. In the frontend, `MemberRosterClient` maintains a single unified state array, derives `admins` and `users` sub-lists purely via filtering, and triggers role transitions through the existing `ConfirmDialog` component.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, PostgreSQL via Prisma ORM, Vitest (Node.js test environment), Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-11-admin-role-management-design.md`

## Global Constraints

- **Single Source of Truth (Invariant 6):** `MemberRosterClient` must manage a single unified `members` array in React state and derive `admins` and `users` purely using `filter()`.
- **Service Layer Isolation (Invariant 1):** Domain business rules, transactions, and database queries live in `src/services/memberService.ts`. Server actions act solely as controller adaptors.
- **Node-based Deterministic Testing (Invariant 7):** All unit and UI tests must run deterministically in Vitest under `environment: "node"` using `renderToStaticMarkup` without browser DOM emulation (`jsdom`).
- **Zero Secrets Leakage:** No session tokens or sensitive fields exposed across boundaries.
- **No Git Commits Without Explicit Consent:** Never run `git commit` unless explicitly instructed by the human partner.

## Review Focus

1. **Self-demotion prevention:** An admin attempting to demote themselves must be rejected by both the UI (omitted demote action, `(Jij)` badge) and the domain service (throwing `"Je kunt je eigen beheerder-rol niet intrekken."`).
2. **Last-admin protection under concurrency:** Demoting an admin when only one admin remains must fail with `"Er moet minstens één beheerder overblijven."`, guarded within `prisma.$transaction`.
3. **Idempotent role updates:** Requesting a role transition to the member's current role must complete cleanly without redundant writes.
4. **Non-admin controller rejection:** Any request to `adminUpdateMemberRoleAction` by an unauthenticated user or non-admin member must return `{ success: false, error: "Niet geautoriseerd." }`.
5. **In-flight submission locking:** The client must prevent duplicate clicks while a role mutation is in flight (`isSubmittingRole`).

---

### Task 1: Domain Service & Transactional Validation (`src/services/memberService.ts`)

**Files:**

- Create: `src/services/memberService.ts`
- Test: `tests/services/memberService.test.ts`

**Interfaces:**

- Produces: `updateMemberRole(targetMemberId: string, newRole: "USER" | "ADMIN", actorId: string): Promise<Member>`

- [x] **Step 1: Write the failing domain service tests**

Create `tests/services/memberService.test.ts` testing:

- Rejection of self-demotion (`actorId === targetMemberId` and `newRole === "USER"`).
- Rejection of non-existent target member.
- Idempotent return when `target.role === newRole`.
- Rejection of demoting the last remaining admin (`adminCount <= 1`).
- Successful promotion from `USER` to `ADMIN`.
- Successful demotion from `ADMIN` to `USER` when multiple admins exist.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/memberService.test.ts`
Expected: FAIL (module `src/services/memberService` not found)

- [x] **Step 3: Implement `updateMemberRole` in `src/services/memberService.ts`**

Implement `updateMemberRole` using `prisma.$transaction`:

- Verify `actorId !== targetMemberId || newRole !== "USER"`.
- Fetch `targetMember`. Throw `"Lid niet gevonden."` if missing.
- Return early if `targetMember.role === newRole`.
- If demoting to `"USER"`, count admins where `role === "ADMIN"`. If `<= 1`, throw `"Er moet minstens één beheerder overblijven."`.
- Call `tx.member.update({ where: { id: targetMemberId }, data: { role: newRole } })` and return updated member.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/memberService.test.ts`
Expected: PASS

---

### Task 2: Server Action Controller (`src/actions/adminActions.ts`)

**Files:**

- Modify: `src/actions/adminActions.ts`
- Test: `tests/admin/adminMemberRoleAction.test.ts`

**Interfaces:**

- Consumes: `updateMemberRole` from `src/services/memberService.ts`, `getSessionMember` from `src/lib/auth.ts`
- Produces: `adminUpdateMemberRoleAction(memberId: string, newRole: "USER" | "ADMIN"): Promise<{ success: boolean; error?: string }>`

- [x] **Step 1: Write the failing server action tests**

Create `tests/admin/adminMemberRoleAction.test.ts`:

- Rejection when `getSessionMember()` returns null or a user with `role === "USER"` (`{ success: false, error: "Niet geautoriseerd." }`).
- Success when called by an admin, returning `{ success: true }`.
- Error forwarding when domain service rejects (e.g. self-demotion or sole admin demotion).

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin/adminMemberRoleAction.test.ts`
Expected: FAIL (`adminUpdateMemberRoleAction` is not exported)

- [x] **Step 3: Implement `adminUpdateMemberRoleAction` in `src/actions/adminActions.ts`**

Add `adminUpdateMemberRoleAction`:

- Authenticate session with `getSessionMember()`.
- Check `currentMember?.role === "ADMIN"`. If not, return `{ success: false, error: "Niet geautoriseerd." }`.
- Call `updateMemberRole(memberId, newRole, currentMember.id)`.
- Revalidate path `/admin/members` inside `try...catch`.
- Return `{ success: true }` or catch and return `{ success: false, error: err.message }`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin/adminMemberRoleAction.test.ts`
Expected: PASS

---

### Task 3: Server Component Wiring (`src/app/admin/members/page.tsx`)

**Files:**

- Modify: `src/app/admin/members/page.tsx`

**Interfaces:**

- Consumes: `currentMember` from `getSessionMember()`
- Passes: `currentMemberId={currentMember.id}` to `MemberRosterClient`

- [x] **Step 1: Update `AdminMembersPage` to pass `currentMemberId`**

Update `src/app/admin/members/page.tsx`:

- Pass `currentMemberId={currentMember.id}` to `<MemberRosterClient />`.

- [x] **Step 2: Run TypeScript check to verify prop alignment**

Run: `npm run typecheck`
Expected: May report prop mismatch until Task 4 updates `MemberRosterClientProps` interface.

---

### Task 4: Partitioned UI with `ConfirmDialog` in `MemberRosterClient.tsx`

**Files:**

- Modify: `src/components/MemberRosterClient.tsx`
- Test: `tests/ui/memberRoster.test.ts`

**Interfaces:**

- Consumes: `adminUpdateMemberRoleAction` from `src/actions/adminActions.ts`, `ConfirmDialog` from `@/components/ConfirmDialog`
- Accepts props: `{ initialMembers: any[]; currentMemberId?: string }`

- [x] **Step 1: Write static rendering tests for partitioned cards**

Create `tests/ui/memberRoster.test.ts` using `renderToStaticMarkup`:

- Verifies "Beheerders" section header and "Leden" section header render with accurate member counts.
- Verifies `(Jij)` badge renders for `currentMemberId` and no demote button is rendered on their row.
- Verifies `↓ Naar Leden` button renders on other admin rows.
- Verifies `↑ Maak Beheerder` button renders on regular member rows.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/memberRoster.test.ts`
Expected: FAIL (partitioned cards not yet present)

- [x] **Step 3: Update `MemberRosterClient.tsx`**

Implement partitioned UI and modal interaction:

- Update props to `{ initialMembers: any[]; currentMemberId?: string }`.
- Maintain unified `members` array in state.
- Derive `admins = members.filter(m => m.role === "ADMIN")` and `regularMembers = members.filter(m => m.role === "USER")`.
- Add dialog state:
  `const [selectedRoleChange, setSelectedRoleChange] = useState<{ member: any; targetRole: "USER" | "ADMIN" } | null>(null);`
  `const [isSubmittingRole, setIsSubmittingRole] = useState(false);`
- Replace single list with two partitioned cards:
  1. **Beheerders Card:** Shield icon, count, lists `admins`. If `m.id === currentMemberId`, show `(Jij)` badge. Otherwise show `↓ Naar Leden` button. Both have `Reset PIN`.
  2. **Leden Card:** Users icon, count, lists `regularMembers`. Each row has `↑ Maak Beheerder` button and `Reset PIN`.
- Add `ConfirmDialog` instance:
  - If `selectedRoleChange?.targetRole === "ADMIN"`:
    - Title: `"${selectedRoleChange.member.name} promoveren naar Beheerder?"`
    - Message: `"${selectedRoleChange.member.name} krijgt volledige rechten om quizzen toe te voegen, details te bewerken, teaminschrijvingen te wijzigen en vrienden te beheren."`
    - Confirm label: `"Ja, Maak Beheerder"`
    - isDestructive: `false`
  - If `selectedRoleChange?.targetRole === "USER"`:
    - Title: `"${selectedRoleChange.member.name} degraderen naar Lid?"`
    - Message: `"${selectedRoleChange.member.name} verliest beheerderstoegang en wordt een gewone speler."`
    - Confirm label: `"Ja, Maak Lid"`
    - isDestructive: `true`
  - On confirm: invoke `adminUpdateMemberRoleAction`, update `members` state with `role: targetRole`, reset dialog state and in-flight flag.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/memberRoster.test.ts`
Expected: PASS

---

### Task 5: End-to-End Verification & Documentation Synchronization

**Files:**

- Modify: `docs/roadmap.md`

- [x] **Step 1: Run comprehensive codebase quality checks**

Run: `npm run check:all`
Expected: All 6 checks (`typecheck`, `test`, `lint`, `format:check`, `audit:check`, `scan:secrets`) pass with 0 errors.

- [x] **Step 2: Update roadmap status**

Update `docs/roadmap.md` Item C9 to reflect active plan tracking:
`[ ] Plan Ready: docs/superpowers/plans/2026-11-11-admin-role-management.md`
