# Archive: v2.4.0 Completed Features & Implementation Notes

- **Release Version:** `v2.4.0`
- **Release Date:** 2026-11-11
- **Design Spec:** [`docs/superpowers/specs/2026-11-11-admin-role-management-design.md`](../specs/2026-11-11-admin-role-management-design.md)
- **Implementation Plan:** [`docs/superpowers/plans/2026-11-11-admin-role-management.md`](../plans/2026-11-11-admin-role-management.md)

---

## Completed Roadmap Items

### Item C9: Admin Role Management (Promote / Demote)

- **Status:** Shipped (`v2.4.0`)
- **Feedback & Rationale:** Member roles (`USER` / `ADMIN`) were previously immutable post-invite creation, requiring direct database intervention whenever teammates took on or stepped down from coordinator roles.
- **Delivered Capabilities:**
  - **Partitioned Overview in `/admin/members`:** Split the member roster into two visually distinct cards: **Beheerders** and **Leden**, mirroring the partitioned lineup layout in quiz details.
  - **Contextual Transfer Actions:** Added `↑ Maak Beheerder` for regular members and `↓ Naar Leden` for other admins.
  - **Confirmation Dialog (`ConfirmDialog`):** Gated all role modifications behind the reusable confirmation modal with tailored warnings to eliminate accidental mis-taps.
  - **Reusable `AlertDialog` Component (`src/components/AlertDialog.tsx`):** Replaced raw browser `window.alert()` with styled, branded dialogs supporting single-action dismissals and redirections across `warning`, `error`, `info`, and `success` modes.
  - **Graceful Unauthorized Session Recovery:** If a demoted administrator attempts an action from an active tab, a friendly warning dialog explains the privilege change and provides a direct button to return to `/quizzes`, where the "Beheer" link is removed.
  - **Domain Service Safeguards (`src/services/memberService.ts`):** Enforced self-demotion prevention and last-admin retention transactionally in PostgreSQL (`prisma.$transaction`).
  - **Single Source of Truth:** `MemberRosterClient` manages a single `members` state collection and derives sub-lists purely via `.filter()`.
