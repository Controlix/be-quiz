# Archive: v2.5.0 Completed Features & Implementation Notes

- **Release Version:** `v2.5.0`
- **Release Date:** 2026-11-12
- **Design Spec:** [`docs/superpowers/specs/2026-11-11-guest-players-design.md`](../specs/2026-11-11-guest-players-design.md)
- **Implementation Plan:** [`docs/superpowers/plans/2026-11-12-guest-players.md`](../plans/2026-11-12-guest-players.md)

---

## Completed Roadmap Items

### Item B5: Guest Players

- **Status:** Shipped (`v2.5.0`)
- **Feedback & Rationale:** Occasional or external substitute players (partners, friends) joining for a specific pub quiz night previously could not be added to the team lineup without registering a permanent account with a PIN.
- **Delivered Capabilities:**
  - **Unrestricted Guest Addition:** Authenticated teammates and administrators can add external guests by name via a dedicated modal dialog (`AddGuestDialog.tsx`).
  - **Decoupled Attendance & Substitute Support:** Guests remain active in their lineup slots even if their inviter declines, allowing members to organize team substitutes.
  - **Fair FIFO Queueing:** Guests participate in standard capacity rules and waitlists identically to registered members.
  - **Attribution & Lineup Badging:** Displayed with clear badges (`Sarah (Gast van Alice)`) in active slots and reserve queues.
  - **Granular Removal Permissions:** Restricted removal actions to the inviting teammate and Admins. Deleting a guest permanently removes the RSVP and advances the reserve queue.
  - **Lockdown Compliance:** Non-admins cannot add or remove guests once `now >= startsAt`; admins retain override capabilities.
  - **Downstream Protection:** Guarded Google Calendar event formatting and post-quiz rating eligibility against null member references.
