# Pub Quiz App (BE-Quiz) — Feedback Archive: v1.1 Completed Items

This document records completed roadmap items and features that have been **fully implemented, verified, and shipped**.

For active roadmap items and upcoming features, see `docs/roadmap.md`.

---

## Completed Items (v1.1 Polish & Enhancements)

### Declined Players Visibility ("Afgemeld")
* **Status:** `[x] Completed & Shipped` ([Design Spec](../specs/2026-10-31-declined-players-visibility-design.md) | [Plan](../plans/2026-10-31-declined-players-visibility.md))
* **Feedback:** When teammates decline (*"Ik pas"*), they disappear from the UI, leaving others wondering who has already responded.
* **Requirement:**
  * Display which team members declined on the quiz details screen so teammates know who is unavailable without asking in WhatsApp.
  * Visible to all logged-in members as a clean, compact section (subtle name chips with `✕` indicator) positioned below the active lineup and reserve players.
  * Admin support: Admins can re-enroll a declined player with a 1-tap `+ Aanmelden` button (`adminOverrideAttendAction`).
* **Scope:** `QuizDetailClient.tsx`, `TeamLineup.tsx`, `rsvpService.ts`, and `adminActions.ts`.

### Unified RSVP State Synchronization & UI Consistency (Single Source of Truth)
* **Status:** `[x] Completed & Shipped` ([Feedback Intake](inbox/2026-10-31-unified-rsvp-state-sync.md) | [Design Spec](../specs/2026-10-31-unified-rsvp-state-design.md) | [Plan](../plans/2026-10-31-unified-rsvp-state.md))
* **Problem / Feedback:** When an admin overrides their own RSVP status (or another player's), the lineup card updates, but the personal participation buttons (*"Ik doe mee"* / *"Ik pas"*) show stale status until page reload.
* **Requirement:** Refactored `QuizDetailClient.tsx` to hold a single `rsvps: ClientRsvp[]` state managed by `rsvpReducer.ts` as the single source of truth, deriving both `RsvpControl` status and `TeamLineup` rosters purely from it.
* **Scope:** `src/lib/rsvpReducer.ts`, `src/components/QuizDetailClient.tsx`, `tests/lib/rsvpReducer.test.ts`.
