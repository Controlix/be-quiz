# Archive: v2.6.0 Completed Features & Implementation Notes

- **Release Version:** `v2.6.0`
- **Release Date:** 2026-11-21
- **Design Spec:** [`docs/superpowers/specs/2026-11-21-admin-member-enrollment-design.md`](../specs/2026-11-21-admin-member-enrollment-design.md)
- **Implementation Plan:** [`docs/superpowers/plans/2026-11-21-admin-member-enrollment.md`](../plans/2026-11-21-admin-member-enrollment.md)

---

## Completed Roadmap Items

### Item #10: Admin Direct Member Lineup Enrollment (Non-Responding Members)

- **Status:** Shipped (`v2.6.0`)
- **Source:** In-App Suggestion (`cmwewq4mh0001l508oh0j4180`)
- **Feedback & Rationale:** Administrators could previously override RSVPs only for teammates who had explicitly declined (`DECLINED`) or add external guest players (`AddGuestDialog`), leaving no direct way to seat registered teammates who confirmed verbally or via WhatsApp without opening the app.
- **Delivered Capabilities:**
  - **1-Tap Admin Enrollment Dialog (`EnrollMemberDialog.tsx`):** Rendered via `+ Teamlid toevoegen` beside `+ Gast toevoegen` on `/quizzes/[id]` for administrators, listing unresponded registered teammates as disabled-while-pending clickable rows with inline error handling and empty-state feedback.
  - **Standard FIFO Capacity & Queue Preservation:** Enrolled teammates enter active slots or the reserve bench under `maxTeamSize` using existing `SELECT ... FOR UPDATE` row locking (`rsvpService.adminOverrideAttend`), preserving existing `queuedSince` if the member became `ATTENDING` concurrently.
  - **Session Audit Integrity:** `adminOverrideAttendAction` enforces `ADMIN` role verification, records `overriddenById` exclusively from `currentMember.id`, and revalidates both `/quizzes` and `/quizzes/[id]`.
  - **Single Source of Truth State & Derivation:** Extended `rsvpReducer.ts` (`ADMIN_OVERRIDE_ATTEND` with optional `name`) and added `deriveUnrespondedMembers()` so enrollment list filtering and lineup rosters share a single authoritative `ClientRsvp[]` array.
