# Implementation Review: Admin Member Lineup Enrollment (`v2.6.0`)

**Date:** 2026-11-21  
**Branch:** `feat/admin-quiz-edit-and-enrollment`  
**Reviewed Spec:** `docs/superpowers/specs/2026-11-21-admin-member-enrollment-design.md`  
**Reviewed Plan:** `docs/superpowers/plans/2026-11-21-admin-member-enrollment.md`  
**Status:** Resolved (all findings fixed and verified)  
**Purpose:** Record verification results and implementation review findings prior to commit and `v2.6.0` release tagging.

---

## 1. Overall Assessment

The core architecture is clean, minimal, and adheres well to the repository's single-source-of-truth and concurrency invariants:

- Reusing `adminOverrideAttend` / `adminOverrideAttendAction` with `SELECT ... FOR UPDATE` row locking and an `alreadyAttending` guard avoids duplicate service code and preserves `queuedSince` and `overriddenById` integrity.
- Client state remains unified in `src/lib/rsvpReducer.ts` with pure derivations (`deriveUnrespondedMembers`), and `src/components/EnrollMemberDialog.tsx` properly guards in-flight taps and resets submission state inside a `finally` block.
- All initial review findings (`B1`, `I1`, `I2`, `M1`, `M2`) have been resolved and verified against `npm run check:all` (see Section 4).

---

## 2. Verification Results

Executed `npm run check:all` and `npm run scan:secrets` against the working tree:

| Check          | Command                                                     | Outcome  | Notes                                                     |
| -------------- | ----------------------------------------------------------- | -------- | --------------------------------------------------------- |
| Typecheck      | `npm run typecheck` (`tsc --noEmit`)                        | **PASS** | —                                                         |
| Test Suite     | `npm run test` (`vitest run`)                               | **PASS** | 81 test files, 284 tests passed (`environment: "node"`)   |
| Lint           | `npm run lint` (`eslint .`)                                 | **PASS** | —                                                         |
| Formatting     | `npm run format:check` (`prettier --check .`)               | **PASS** | —                                                         |
| Security Audit | `npm run audit:check` (`audit-ci --config ./audit-ci.json`) | **PASS** | Patched via `effect@^3.22.5` override (0 vulnerabilities) |
| Secret Scan    | `npm run scan:secrets` (`secretlint "**/*"`)                | **PASS** | —                                                         |

---

## 3. Findings & Remarks

### B1 — `npm run check:all` fails on `audit:check` (Blocking)

- **Where:** `docs/superpowers/plans/2026-11-21-admin-member-enrollment.md:521-522`, `audit-ci.json`, `package-lock.json`
- **Detail:** Plan Step 6 is marked `[x]` expecting `npm run check:all` to pass with exit code 0, but `audit-ci` fails on `GHSA-7589-6fvf-x4pw` (`prisma > @prisma/config > effect <=3.22.0`). Per `AGENTS.md`, `audit-ci.json` must remain strictly empty unless an exception is explicitly approved by the human partner.
- **Recommended Action:** Investigate a non-breaking `effect` transitive override in `package.json#overrides` (or Prisma 6 patch if available) and re-run `npm run check:all` until it exits 0.

### I1 — Undocumented `excludeMemberId` divergence across code, spec, and architecture docs (Important)

- **Where:** `src/lib/rsvpReducer.ts:203-212`, `src/components/QuizDetailClient.tsx:68`, `docs/architecture/rsvp-state.md:128-134`, `docs/superpowers/specs/2026-11-21-admin-member-enrollment-design.md:169,182-184`
- **Detail:** `QuizDetailClient.tsx` passes `currentMemberId` as the 3rd argument (`excludeMemberId`) to `deriveUnrespondedMembers(allMembers, rsvps, currentMemberId)`. However:
  1. Both the design spec and `docs/architecture/rsvp-state.md` document `deriveUnrespondedMembers(allMembers, rsvps)` with **two parameters**, omitting `excludeMemberId`.
  2. If the logged-in admin has not yet responded themselves while all other teammates have, `enrollableMembers` evaluates to `[]` and `EnrollMemberDialog` shows _"Alle teamleden hebben al gereageerd."_, which is slightly misleading given the `Player Dual-Identity` model.
- **Recommended Action:** Either keep `excludeMemberId` (since admins have `RsvpControl` directly above) and update `docs/architecture/rsvp-state.md`, the spec, and optionally the empty-state copy to match, **or** remove `excludeMemberId` from `QuizDetailClient.tsx` so implementation matches the spec and architecture documentation.

### I2 — Missing `try/catch` in `handleAdminOverrideAttend` (Important)

- **Where:** `src/components/QuizDetailClient.tsx:147-154`
- **Detail:** `handleAdminOverrideAttend` was updated to await `adminOverrideAttendAction` before dispatching `ADMIN_OVERRIDE_ATTEND` and checks `if (!res.success)`, but unlike `handleRemoveGuest` (`121-132`) and `handleEnrollMember` (`156-167`), it does not wrap the Server Action call in `try/catch`. An unexpected rejection (e.g., transient network failure) results in an unhandled promise rejection instead of surfacing an error via `AlertDialog`.
- **Recommended Action:** Wrap the `adminOverrideAttendAction` call in `try/catch` and route caught errors to `setErrorMessage(err?.message || "Fout bij aanmelden van speler")`.

### M1 — Stale mock return type in `tests/admin/adminAttendAction.test.ts` (Minor)

- **Where:** `tests/admin/adminAttendAction.test.ts:36`
- **Detail:** The `"allows admin to re-enroll a player"` test still mocks `vi.spyOn(rsvpService, "adminOverrideAttend").mockResolvedValue(undefined as any)`, whereas `adminOverrideAttend` now returns `Promise<{ quizId: string }>`.
- **Recommended Action:** Update the mock return value to `{ quizId: "quiz-1" }` to match the service contract.

### M2 — Missing dialog accessibility attributes in `EnrollMemberDialog.tsx` (Minor)

- **Where:** `src/components/EnrollMemberDialog.tsx:49-65`
- **Detail:** The modal overlay lacks `role="dialog"` and `aria-modal="true"`, and the icon-only `<X />` close button lacks `aria-label="Sluiten"` (consistent with `AddGuestDialog.tsx`, which has the same omission, but straightforward to improve).
- **Recommended Action:** Add `role="dialog"`, `aria-modal="true"`, and `aria-label="Sluiten"` on the close button.

### N1 — Working tree scope & sibling action consistency (Note)

- **Mixed Working Tree Changes:** The active working tree also includes `AGENTS.md` rule additions and a `next` / `eslint-config-next` bump (`16.4.3` -> `16.4.6`) in `package.json` / `package-lock.json` alongside the `v2.6.0` feature changes. Separate or review intentionally before committing.
- **Sibling Action (`src/actions/adminActions.ts:54-73`):** `adminOverrideDeclineAction` (outside `v2.6.0` scope) still forwards the client-supplied `adminId` parameter instead of `currentMember.id` and only revalidates `/quizzes` rather than `/quizzes/${quizId}`. Consider hardening in a follow-up.

---

## 4. Resolution Status

All findings from this review have been resolved and verified:

- **B1 Resolved:** Added `"effect": "^3.22.5"` to `package.json#overrides` to patch `GHSA-7589-6fvf-x4pw`. `npm run audit:check` now passes with 0 vulnerabilities.
- **I1 Resolved:** Synchronized `docs/architecture/rsvp-state.md` and `docs/superpowers/specs/2026-11-21-admin-member-enrollment-design.md` to document the 3rd `excludeMemberId` argument on `deriveUnrespondedMembers()`.
- **I2 Resolved:** Wrapped `handleAdminOverrideAttend` in `src/components/QuizDetailClient.tsx` in a `try/catch` routing errors to `setErrorMessage`.
- **M1 Resolved:** Updated mock return in `tests/admin/adminAttendAction.test.ts` to `{ quizId: "quiz-1" }`.
- **M2 Resolved:** Added `role="dialog"`, `aria-modal="true"`, and `aria-label="Sluiten"` to `EnrollMemberDialog.tsx` with covering assertions in `tests/components/EnrollMemberDialog.test.tsx`.
- **Full Verification:** `npm run check:all` passed with exit code 0.
