# Pub Quiz App (BE-Quiz) — Feedback Archive: v2.0 Completed Items

This document records completed roadmap items and features that have been **fully implemented, verified, and shipped**.

For active roadmap items and upcoming features, see `docs/roadmap.md`.

---

## Completed Items (v2.0 Integrations & Logistics)

### Shared Team Google Calendar (Google Cloud)
* **Status:** `[x] Completed & Shipped` ([Design Spec](../specs/2026-11-01-shared-google-calendar-design.md) | [Plan](../plans/2026-11-01-shared-google-calendar.md))
* **Intent:** Replaced manual individual calendar exports with an automated, server-side integration that syncs officially registered pub quizzes directly to the team's shared Google Calendar via Google Calendar API v3 and Google Service Account credentials.
* **Architecture:**
  * Strongly-typed in-process Domain Event Bus (`src/lib/events/`).
  * Core domain services (`registrationService`, `quizService`, `rsvpService`, `paymentService`) emit domain events with zero coupling to external APIs.
  * Isolated subscriber in `src/features/calendar/shared/` coordinates formatting (Brussels timezone, active lineup, payment status with payer, direct app link) and synchronizes with Google Calendar.
  * Persistent event tracking in isolated `CalendarEventMapping` database model.
  * Server startup registration wired via `src/instrumentation.ts` when `ENABLE_SHARED_GOOGLE_CALENDAR=true`.
