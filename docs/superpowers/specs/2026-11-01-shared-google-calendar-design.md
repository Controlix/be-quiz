# Design Document: Shared Team Google Calendar Integration

**Date:** 2026-11-01  
**Status:** Draft  
**Target Milestone:** v2.0 (Integrations & Logistics)  
**Document Path:** `docs/superpowers/specs/2026-11-01-shared-google-calendar-design.md`  

---

## 1. Intent & The Why

Currently, team players must manually click "Add to Google Calendar" or download `.ics` files to get quiz dates onto their individual personal calendars. This creates coordination friction: dates get forgotten, team lineups are not visible in personal calendar views, and changes (reschedules, venue updates, cancellations) are not propagated unless every player manually re-downloads or re-adds the event.

The **Shared Team Google Calendar Integration** connects the app directly to the team's central Google Calendar in Google Cloud. When the team officially registers for a pub quiz, the app automatically publishes an event to the shared calendar with all necessary details (lineup, venue, payment status, app link). When quiz details, lineups, or payment statuses change, the shared calendar entry updates automatically in the background.

Crucially, **the web app remains the authoritative single source of truth**. The Google Calendar is a read-only projection/view for the team to view on their phones without needing to open the web app.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
1. **Automated Team Calendar View:** Automatically manage event entries on the team's shared Google Calendar via Google Calendar API v3 using a Google Cloud Service Account.
2. **Coexistence with Personal Exports:** Keep existing personal `.ics` and personal Google Calendar export links intact under their existing `ENABLE_ICAL_EXPORT` capability, completely independent of the shared calendar.
3. **Core Domain Independence:** The core application (`quizService`, `rsvpService`, `registrationService`, `paymentService`, `prisma/schema.prisma`) must remain 100% unaware of Google Calendar or third-party APIs.
4. **Event-Driven Architecture:** The core emits fine-grained, strongly-typed domain events; the calendar module subscribes to these events asynchronously.
5. **Accurate Lifecycle Triggers:**
   - **Create:** Only when a team is officially registered (*"Ploeg ingeschreven"*). Quizzes in planning/draft stay in the app only.
   - **Delete/Remove:** When registration is cancelled (*"Inschrijving annuleren"*) or the quiz is marked `CANCELLED`.
   - **Update:** When an already-registered quiz has its details edited (date, time, venue), its player lineup changes (RSVP update), or its payment status changes.
6. **Rich, Self-Contained Calendar Entries:** Team members glancing at Google Calendar see:
   - **Event Title:** Quiz title
   - **Date & Time:** Start time and calculated end time (`startsAt` + `durationMinutes`), explicitly in `Europe/Brussels` time zone.
   - **Location:** Full venue address (for 1-tap navigation via Google Maps).
   - **Description:**
     - Active player lineup (attending members in the team)
     - Entry fee, payment status, and payer name (e.g., `Inschrijvingsgeld: €20 (Betaald door Marc)`)
     - Direct link back to the quiz in the app for RSVP changes
7. **Capability Decoupling:** Gated behind `ENABLE_SHARED_GOOGLE_CALENDAR=true`. If disabled or unconfigured, the system runs with zero overhead and attaches no listeners.
8. **Resilient Error Isolation:** Background API failures must never fail the user request, roll back transactions, or crash the Node process. Failures are captured with structured console logging.

### 2.2 Non-Goals
1. **Two-Way Sync:** We do not read edits made in Google Calendar back into the app. The app is strictly the master source of truth.
2. **Syncing Unregistered/Draft Quizzes:** Quizzes that the team hasn't registered for are NOT pushed to Google Calendar.
3. **Dedicated Sync Button in UI:** Admins do not need a custom sync button; undoing and redoing registration achieves a clean re-sync naturally.
4. **Generic Background Error Admin Screen (Deferred):** An administrative database error log and resolution dashboard is deferred to a dedicated roadmap item.
5. **Inviting Individual Email Addresses:** We do not invite member email addresses to calendar events; the service account simply writes to the team's shared Google Calendar ID.

### 2.3 Anti-Goals
1. **Never Pollute Core Schema:** Never add `googleCalendarEventId` or Google fields to `Quiz` or `Team` tables.
2. **Never Block Core Actions:** Never let a Google API downtime, network timeout, or expired credential prevent a team registration, RSVP, or quiz edit from saving.
3. **Never Scour or Interfere with Unrelated Integrations:** AI Vision, WhatsApp sharing, and personal iCal export remain discrete, independent features.

---

## 3. Evaluated Approaches & Decision

### Approach 1: Typed In-Process Event Bus + Isolated Calendar Subscriber (Selected)
- **Description:** Implement a typed domain event bus in `src/lib/events/`. Core services emit fine-grained events (`team.registered`, `team.registration_cancelled`, `quiz.details_updated`, `team.roster_changed`, `team.payment_changed`). A subscriber in `src/features/calendar/shared/` listens asynchronously, queries necessary data, and calls Google Calendar API. An isolated Prisma mapping model `CalendarEventMapping` tracks Google Event IDs.
- **Trade-offs:** 
  - *Pros:* Strictly enforces Core Domain Independence, testable in isolation, highly extensible for future roadmap features (WhatsApp announcements, reminders), minimal runtime overhead.
  - *Cons:* In-memory asynchronous execution is scoped to server process lifecycle.
- **Decision:** **Accepted.** Best architectural alignment with project invariants.

### Approach 2: Database Query Interceptor (Prisma Client Extension)
- **Description:** Intercept Prisma mutations on `Team`, `Rsvp`, and `Quiz` using `$extends`.
- **Trade-offs:** 
  - *Pros:* Automatic interception without service calls.
  - *Cons:* Too magical, hard to trace in deterministic tests, risks running side-effects during seeds or nested transactions.
- **Decision:** **Rejected.**

### Approach 3: Composite Application Orchestrators
- **Description:** Sequential orchestrator services calling core and integration services.
- **Trade-offs:** 
  - *Pros:* Linear code flow.
  - *Cons:* Direct coupling; breaks event-driven observer pattern and scalability for other listeners.
- **Decision:** **Rejected.**

---

## 4. Technical Architecture & System Design

### 4.1 System Diagram & Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                       Core Domain                           │
│                                                             │
│  [registrationService] ──┐                                  │
│  [quizService]         ──┼──> domainEvents.emit(event)      │
│  [rsvpService]         ──┤    (In-Process Typed Bus)        │
│  [paymentService]      ──┘                                  │
└──────────────────────────────────────┬──────────────────────┘
                                       │ (Async Domain Event)
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Feature: Shared Google Calendar                  │
│                                                             │
│  [Calendar Event Subscriber]                                │
│    ├── Check ENABLE_SHARED_GOOGLE_CALENDAR capability       │
│    ├── Query CalendarEventMapping (DB)                      │
│    ├── Format self-contained event payload                  │
│    ├── Call Google Calendar API v3 (Service Account)        │
│    └── Update / Delete CalendarEventMapping                 │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Fine-Grained Domain Event Types (`src/lib/events/types.ts`)

```typescript
export type DomainEvent =
  | { type: "team.registered"; quizId: string; occurredAt: Date }
  | { type: "team.registration_cancelled"; quizId: string; occurredAt: Date }
  | { type: "quiz.details_updated"; quizId: string; occurredAt: Date }
  | { type: "team.roster_changed"; quizId: string; occurredAt: Date }
  | { type: "team.payment_changed"; quizId: string; occurredAt: Date }
  | { type: "quiz.cancelled"; quizId: string; occurredAt: Date };

export interface DomainEventBus {
  emit(event: DomainEvent): void;
  subscribe<T extends DomainEvent["type"]>(
    type: T,
    handler: (event: Extract<DomainEvent, { type: T }>) => Promise<void> | void
  ): () => void;
  clear(): void; // Essential for test isolation
}
```

### 4.3 Database Model Isolation (`prisma/schema.prisma`)

A separate model dedicated to the calendar feature:

```prisma
model CalendarEventMapping {
  id              String   @id @default(cuid())
  quizId          String   @unique
  externalEventId String
  calendarId      String
  syncedAt        DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([quizId])
}
```
*Note: No foreign key to `Quiz` is strictly required if we want 100% database schema independence, but a `@relation(fields: [quizId], references: [id], onDelete: Cascade)` can be used to ensure cleanup if a quiz is deleted.*

### 4.4 Google Calendar API Client & Service Account Auth

Authentication via Google Service Account:
- **Environment Variables:**
  - `ENABLE_SHARED_GOOGLE_CALENDAR=true`
  - `GOOGLE_CALENDAR_ID`: Target shared calendar ID (e.g. `c_...0123@group.calendar.google.com`).
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email of the service account (e.g. `be-quiz-sync@<project-id>.iam.gserviceaccount.com`).
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Private RSA key from service account JSON (with `\n` newline handling).
- **Google API Scope:** `https://www.googleapis.com/auth/calendar.events`
- **Client Implementation:** Lightweight wrapper using `googleapis` npm package (or pure JWT auth if zero new heavy dependencies are preferred). `googleapis` is standard, robust, and handles token caching/refresh automatically.

#### Setup & Credential Provisioning Procedure
1. **Google Calendar:** In Google Calendar Settings > *Integrate calendar*, copy the **Calendar ID**.
2. **Google Cloud Console:** Create project, enable **Google Calendar API**, create a Service Account, generate a JSON key.
3. **Calendar Sharing Delegation:** In Google Calendar Settings > *Share with specific people or groups*, add the service account email with permission **"Make changes to events"**.

### 4.5 Calendar Event Payload Formatting

- **Summary / Title:** `${quiz.title}`
- **Location:** `${quiz.location}`
- **Start / End Times:**
  - `start.dateTime`: ISO string with Brussels timezone offset.
  - `start.timeZone`: `quiz.timeZone` (defaults to `"Europe/Brussels"`).
  - `end.dateTime`: `startsAt + quiz.durationMinutes` (Brussels offset).
  - `end.timeZone`: `quiz.timeZone`.
- **Description:**
  ```text
  Ploeg: Alice, Bob, Charlie, Dave
  Inschrijvingsgeld: €20 / ploeg (Betaald door Marc)

  Bekijk of wijzig je RSVP in de app:
  https://quiz.example.com/quizzes/clx...
  ```
  *(If payment is unpaid: `Inschrijvingsgeld: €20 / ploeg (Nog niet betaald)`)*

### 4.6 Synchronization Logic & Event Handlers

1. **`team.registered`:**
   - Fetch quiz details, team lineup, payment status.
   - Check if `CalendarEventMapping` already exists.
   - If not: Call `calendar.events.insert()`, save mapping record.
   - If yes: Call `calendar.events.update()`, update mapping record.
2. **`team.registration_cancelled` or `quiz.cancelled`:**
   - Check if `CalendarEventMapping` exists for `quizId`.
   - If exists: Call `calendar.events.delete(calendarId, externalEventId)` (handle 404/410 gracefully if already deleted on Google).
   - Delete mapping record from database.
3. **`quiz.details_updated`, `team.roster_changed`, `team.payment_changed`:**
   - Check if `CalendarEventMapping` exists for `quizId`.
   - If no mapping: No-op (quiz is not registered/active on the calendar).
   - If mapping exists: Fetch latest details, format payload, call `calendar.events.update()`, update mapping timestamp.

### 4.7 Error Isolation & Safety Invariants

- All subscriber logic runs inside a `try / catch` block.
- Errors are logged via `console.error("[GoogleCalendarSync] Error syncing quiz:", { quizId, eventType: event.type, error })`.
- The subscriber never propagates errors to the caller.
- Unregistering and re-registering can be performed by an admin at any time to re-trigger a fresh sync if credentials were temporarily invalid.

---

## 5. Testing & Verification Plan

Following the project's **Node-based Deterministic Testing** invariant:
1. **Event Bus Unit Tests (`tests/lib/events.test.ts`):**
   - Verify subscriptions, event emissions, multiple handlers, and test cleanup (`clear()`).
   - Verify that an error in one handler does not prevent other handlers from executing.
2. **Calendar Formatter Unit Tests (`tests/features/calendar/shared-formatter.test.ts`):**
   - Pure function tests: verify summary, location, start/end dates with Brussels timezone, lineup string formatting, payment strings (paid with payer vs unpaid), and app URL generation.
3. **Shared Calendar Subscriber Tests (`tests/features/calendar/shared-subscriber.test.ts`):**
   - Mock the Google Calendar API client interface.
   - Test `team.registered`: verifies Google `insert` call and mapping creation.
   - Test `team.registration_cancelled`: verifies Google `delete` call and mapping removal.
   - Test `team.roster_changed` & `team.payment_changed`: verifies Google `update` call when mapping exists; verifies no-op when mapping is absent.
   - Test error handling: verifies Google API failure is caught and logged without throwing.
4. **Service Integration Verification:**
   - Verify that calling `registrationService.registerTeam()` emits `team.registered`.
   - Verify that calling `rsvpService.setRsvp()` emits `team.roster_changed`.
   - Verify that calling `paymentService.markPaid()` emits `team.payment_changed`.
5. **OpenAPI & Capability Verification:**
   - Update Capability Registry tests to confirm `ENABLE_SHARED_GOOGLE_CALENDAR` defaults to `false`.

---

## 6. What's Left to the Builder

The builder has full discretion over:
- Choice of Google client implementation: `googleapis` package vs. a minimal custom JWT/fetch client to avoid dependency weight.
- Exact styling/layout of the text description in the Google Calendar event (e.g. bolding, separator lines).
- Internal file organization within `src/features/calendar/shared/`.
