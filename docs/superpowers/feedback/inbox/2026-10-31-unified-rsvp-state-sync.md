# Feedback Intake: Unified RSVP State Synchronization & UI Consistency

- **Date:** 2026-10-31
- **Reporter / Source:** User testing
- **Area:** Quiz Detail View (`QuizDetailClient.tsx`, `RsvpControl.tsx`, `TeamLineup.tsx`)

---

## 1. Observed Problem
When an admin overrides a member's RSVP status (for example, declining themselves via *"Afzeggen"* or re-enrolling themselves via *"+ Aanmelden"*), the lineup card updates, but the personal participation control (*"Jouw deelname"* buttons: *"Ik doe mee"* / *"Ik pas"*) retains the previous status until a manual browser refresh.

## 2. Root Cause
In `QuizDetailClient.tsx`, the component maintains duplicated, fragmented state:
- `attendees` (array of attending lineup members)
- `declinedMembers` (array of declined members)
- `currentUserRsvp` (separate state variable initialized on page load)

Because mutations update the roster arrays but do not cleanly synchronize the separate `currentUserRsvp` state, the UI can show contradictory statuses simultaneously (e.g. user appears in "Afgemeld", yet *"Ik doe mee"* button is highlighted).

## 3. Architectural Solution
Unify the RSVP state into a **single source of truth** modeled after the domain `Rsvp` entity (`rsvps: Array<{ memberId, memberName, status, queuedSince }>`):
1. **Single State:** Store the unified `rsvps` list in `QuizDetailClient`.
2. **`RsvpControl` Derivation:** Current user status is read directly from `rsvps.find(r => r.memberId === currentMemberId)?.status`.
3. **`TeamLineup` Derivation:** Attending lineup, reserves, and declined chips are computed cleanly from this single collection.
4. **Mutations:** All RSVP actions (user RSVP, admin decline override, admin re-enroll override, drag reorder) mutate the single `rsvps` collection, guaranteeing that *"Jouw deelname"* and *"Opstelling"* can never fall out of sync.
