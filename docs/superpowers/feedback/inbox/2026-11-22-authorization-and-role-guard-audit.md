# Feedback Intake: Authorization & Role Guard Codebase Audit

- **Date:** 2026-11-22
- **Source:** Codebase authorization audit & architecture documentation review
- **Reporter:** Marc / System Audit
- **Status:** Pending Triage into `docs/roadmap.md`

---

## Executive Summary

An audit was conducted across frontend routes/components and backend Server Actions/Route Handlers to evaluate:

1. What roles are supported by the system.
2. Whether every action in the front- and backend is guarded by a role check.

### Role Hierarchy & Model

- **Database Model:** Single `Role` enum in `prisma/schema.prisma` with values `USER` and `ADMIN`.
- **System Actors:**
  - **Anonymous / Visitor:** Unauthenticated guest (can log in, redeem invites, export public calendar feeds, or report bugs).
  - **`USER` (Regular Team Member):** Standard authenticated teammate (self-RSVP, view quizzes, invite guests, mark team registration, toggle payment, create quizzes).
  - **`ADMIN` (Team Coordinator):** Authenticated teammate with operational authority (lineup reordering, bench/reinstate players, update team capacity, cancel quizzes, manage members, configure team settings).
- **Core Invariant:** Per ADR 0008, not every action is or should be guarded by an `ADMIN` role check. Actions are cleanly partitioned into public endpoints, member actions, ownership-guarded actions, and admin-only actions.

However, the audit revealed several specific discrepancies and authorization hygiene gaps between the documented design and current implementation.

---

## Itemized Discrepancies & Observations

### 1. Unguarded Dead Action: `resetRegisteredAction` in `registrationActions.ts`

- **Affected File:** `src/actions/registrationActions.ts` (lines 17–25)
- **Observation:**
  ```ts
  export async function resetRegisteredAction(teamId: string) {
    try {
      await adminResetRegistration(teamId);
      revalidatePath("/quizzes");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  ```
- **Risk / Gap:**
  In `src/actions/adminActions.ts`, `adminResetRegistrationAction` correctly verifies `currentMember.role === "ADMIN"`. However, `registrationActions.ts` exports an unguarded legacy variant (`resetRegisteredAction`) that invokes `adminResetRegistration(teamId)` without checking authentication or role.
- **Remediation:** Remove the dead `resetRegisteredAction` export from `registrationActions.ts` and ensure all consumers rely exclusively on `adminResetRegistrationAction`.

---

### 2. Client-Supplied Member Identity in Server Actions (Broken Object Level Authorization / BOLA Risk)

- **Affected Files:**
  - `src/actions/rsvpActions.ts` (`joinQuizRsvpAction`, `declineQuizRsvpAction`)
  - `src/actions/registrationActions.ts` (`setRegisteredAction`, `toggleFeePaidAction`)
  - `src/actions/quizActions.ts` (`createQuizAction`)
- **Observation:**
  These Server Actions accept `memberId: string` or `creatorId: string` directly as arguments passed from the client instead of extracting the authenticated member ID from the active session cookie:
  ```ts
  // Example in src/actions/rsvpActions.ts
  export async function joinQuizRsvpAction(teamId: string, memberId: string, quizId?: string) {
    await setRsvp(teamId, memberId, "ATTENDING");
    ...
  }
  ```
- **Risk / Gap:**
  A malicious or manipulated client could pass an arbitrary `memberId` to RSVP, register, or toggle fees on behalf of other teammates without holding an `ADMIN` role.
- **Remediation:**
  Refactor these actions to resolve the session member via `await getSessionMember()` on the server:
  - If unauthenticated, reject with `{ success: false, error: "Niet ingelogd." }`.
  - Use `sessionMember.id` as the authoritative identity for self-actions.
  - If a memberId is supplied that does not match `sessionMember.id`, require `sessionMember.role === "ADMIN"`.

---

### 3. Missing Session Authentication on Upload & AI Vision Route Handlers

- **Affected Files:**
  - `src/app/api/quizzes/upload-flyer/route.ts`
  - `src/app/api/quizzes/extract/route.ts`
- **Observation:**
  Both endpoints perform payload validation (file size <= 4MB, MIME types, magic bytes) and check capability flags (`getCapabilities().vision`), but neither verifies whether the incoming request contains a valid member session token cookie.
- **Risk / Gap:**
  Anonymous external clients can upload files to server storage or trigger Gemini / OpenAI Vision API extraction requests, potentially exhausting storage quota or consuming billable API tokens.
- **Remediation:**
  Add session verification via `getSessionMember()` to both route handlers, returning `401 Unauthorized` if no active session cookie exists.

---

## Next Steps & Triage

1. Distill these findings into a dedicated technical debt / security hardening item in `docs/roadmap.md` under **Part 2, Category C. Member Management & Security** (e.g., `[#C.5] Server Action & Route Handler Authorization Hardening`).
2. Implement fixes according to TDD and verify with unit/integration tests in Vitest.
3. Update `CHANGELOG.md` upon completion and archive this entry to `docs/superpowers/feedback/archive-<milestone>-completed.md`.
