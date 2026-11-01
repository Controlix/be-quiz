# Shared Team Google Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an automated, decoupled integration that pushes officially registered pub quizzes to a shared team Google Calendar via Google Calendar API v3 and Google Cloud Service Account, while keeping the core domain pure and event-driven.

**Architecture:** A strongly-typed in-process Domain Event Bus (`src/lib/events/`) emits fine-grained events from core domain services. An asynchronous subscriber in `src/features/calendar/shared/` listens to events, formats self-contained event payloads (Brussels timezone, active lineup, payment status with payer, and app URL), and synchronizes with Google Calendar using an isolated `CalendarEventMapping` database model. Gated by `ENABLE_SHARED_GOOGLE_CALENDAR=true`.

**Tech Stack:** TypeScript, Next.js (App Router), Prisma (PostgreSQL), Vitest (`environment: "node"`), Google Calendar API v3 / Google Service Account Auth.

**Spec:** `docs/superpowers/specs/2026-11-01-shared-google-calendar-design.md`

## Global Constraints

- Never add Google Calendar fields (`googleCalendarEventId`, etc.) to the core `Quiz` or `Team` database models.
- Core domain services (`quizService`, `rsvpService`, `registrationService`, `paymentService`) must have zero imports or calls to Google APIs or calendar feature modules.
- All domain events are dispatched in-process and executed asynchronously without blocking the user's HTTP request or database transactions.
- Errors during Google API calls must be caught, structured, and logged to `console.error`; they must never fail the user request or roll back database transactions.
- All testing runs in Vitest under `environment: "node"`; pure domain formatting and event logic must be tested with 100% determinism without browser DOM emulation.
- Never run `git commit` without explicit consent from the user.

## Review Focus

1. **Multiline RSA Private Key Handling:** `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` passed via environment variables often contains literal `\n` characters; must be correctly unescaped to valid PEM format.
2. **Missing or 404 Google Calendar Event on Delete/Update:** If an event was deleted directly in Google Calendar by an admin, subsequent `update` or `delete` API calls must handle HTTP 404/410 cleanly and clean up the database mapping without throwing.
3. **Draft/Unregistered Quizzes Never Synced:** Quizzes in `OPEN` status that are not officially registered must never produce Google Calendar events, and detail updates to them must be ignored.
4. **Idempotent Registration:** Calling registration multiple times or re-registering must not create duplicate Google Calendar events for the same quiz; it must reuse the existing mapping or update it.
5. **Event Bus Error Isolation:** A throwing listener in the event bus must not halt other subscribers or bubble unhandled rejections to the caller.

---

### Task 1: Typed In-Process Domain Event Bus

**Files:**
- Create: `src/lib/events/types.ts`
- Create: `src/lib/events/bus.ts`
- Create: `src/lib/events/index.ts`
- Test: `tests/lib/events.test.ts`

**Interfaces:**
- Consumes: None (pure TypeScript).
- Produces:
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
    clear(): void;
  }

  export const domainEvents: DomainEventBus;
  ```

- [x] **Step 1: Write the failing tests for DomainEventBus**

```typescript
// tests/lib/events.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { domainEvents } from "@/lib/events";

describe("DomainEventBus", () => {
  beforeEach(() => {
    domainEvents.clear();
  });

  it("calls subscriber when subscribed event is emitted", async () => {
    const handler = vi.fn();
    domainEvents.subscribe("team.registered", handler);

    domainEvents.emit({ type: "team.registered", quizId: "quiz-1", occurredAt: new Date() });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ quizId: "quiz-1" }));
  });

  it("does not call subscriber for different event type", () => {
    const handler = vi.fn();
    domainEvents.subscribe("team.registered", handler);

    domainEvents.emit({ type: "quiz.cancelled", quizId: "quiz-1", occurredAt: new Date() });

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes cleanly when unsubscribe function is invoked", () => {
    const handler = vi.fn();
    const unsubscribe = domainEvents.subscribe("team.registered", handler);

    unsubscribe();
    domainEvents.emit({ type: "team.registered", quizId: "quiz-1", occurredAt: new Date() });

    expect(handler).not.toHaveBeenCalled();
  });

  it("isolates errors so a throwing subscriber does not break other subscribers or emit caller", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const faultyHandler = vi.fn().mockImplementation(() => {
      throw new Error("Subscriber crash");
    });
    const goodHandler = vi.fn();

    domainEvents.subscribe("team.registered", faultyHandler);
    domainEvents.subscribe("team.registered", goodHandler);

    expect(() => {
      domainEvents.emit({ type: "team.registered", quizId: "quiz-1", occurredAt: new Date() });
    }).not.toThrow();

    expect(goodHandler).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("resets subscribers when clear() is called", () => {
    const handler = vi.fn();
    domainEvents.subscribe("team.registered", handler);
    domainEvents.clear();

    domainEvents.emit({ type: "team.registered", quizId: "quiz-1", occurredAt: new Date() });
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/events.test.ts`  
Expected: FAIL with module `@/lib/events` not found.

- [x] **Step 3: Implement `types.ts`, `bus.ts`, and `index.ts` in `src/lib/events/`**

Create:
- `src/lib/events/types.ts`: Define `DomainEvent` union and `DomainEventBus` interface.
- `src/lib/events/bus.ts`: Implement `EventBus` class with `Map<string, Set<Function>>`. When emitting, run handlers inside `try/catch` (handling both sync throws and async promise rejections with `Promise.resolve().catch(...)`), logging unhandled errors to `console.error`.
- `src/lib/events/index.ts`: Export singleton `domainEvents` instance and event types.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/events.test.ts`  
Expected: PASS (all 5 tests pass).

---

### Task 2: Core Domain Services Event Emission

**Files:**
- Modify: `src/services/registrationService.ts`
- Modify: `src/services/quizService.ts`
- Modify: `src/services/rsvpService.ts`
- Modify: `src/services/paymentService.ts`
- Test: `tests/services/domain-events-emission.test.ts`

**Interfaces:**
- Consumes: `domainEvents` from `@/lib/events`.
- Produces: Emitted domain events on every state-changing business action.

- [x] **Step 1: Write tests for event emissions across domain services**

```typescript
// tests/services/domain-events-emission.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { domainEvents } from "@/lib/events";
import { registerTeam, unregisterTeam } from "@/services/registrationService";
import { updateQuizDetails, cancelQuiz } from "@/services/quizService";
import { setRsvp } from "@/services/rsvpService";
import { markTeamPaid, markTeamUnpaid } from "@/services/paymentService";
import { prisma } from "@/lib/prisma";

describe("Domain Services Event Emission", () => {
  beforeEach(() => {
    domainEvents.clear();
  });

  it("emits team.registered when registerTeam succeeds", async () => {
    const spy = vi.fn();
    domainEvents.subscribe("team.registered", spy);

    // Call service with existing test quiz/team
    // Verify spy was called with { type: "team.registered", quizId: expect.any(String) }
  });

  it("emits team.registration_cancelled when unregisterTeam succeeds", async () => {
    const spy = vi.fn();
    domainEvents.subscribe("team.registration_cancelled", spy);
    // Call unregisterTeam
    // Verify spy was called
  });

  it("emits quiz.details_updated when updateQuizDetails succeeds", async () => {
    const spy = vi.fn();
    domainEvents.subscribe("quiz.details_updated", spy);
    // Call updateQuizDetails
    // Verify spy was called
  });

  it("emits quiz.cancelled when cancelQuiz succeeds", async () => {
    const spy = vi.fn();
    domainEvents.subscribe("quiz.cancelled", spy);
    // Call cancelQuiz
    // Verify spy was called
  });

  it("emits team.roster_changed when setRsvp changes an attending RSVP", async () => {
    const spy = vi.fn();
    domainEvents.subscribe("team.roster_changed", spy);
    // Call setRsvp
    // Verify spy was called
  });

  it("emits team.payment_changed when markTeamPaid succeeds", async () => {
    const spy = vi.fn();
    domainEvents.subscribe("team.payment_changed", spy);
    // Call markTeamPaid
    // Verify spy was called
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/domain-events-emission.test.ts`  
Expected: FAIL because services do not emit domain events yet.

- [x] **Step 3: Add `domainEvents.emit(...)` to service methods**

In:
- `src/services/registrationService.ts`:
  - In `registerTeam`: `domainEvents.emit({ type: "team.registered", quizId: team.quizId, occurredAt: new Date() })`
  - In `unregisterTeam`: `domainEvents.emit({ type: "team.registration_cancelled", quizId: team.quizId, occurredAt: new Date() })`
- `src/services/quizService.ts`:
  - In `updateQuizDetails`: `domainEvents.emit({ type: "quiz.details_updated", quizId, occurredAt: new Date() })`
  - In `cancelQuiz`: `domainEvents.emit({ type: "quiz.cancelled", quizId, occurredAt: new Date() })`
- `src/services/rsvpService.ts`:
  - In `setRsvp`: `domainEvents.emit({ type: "team.roster_changed", quizId: team.quizId, occurredAt: new Date() })`
- `src/services/paymentService.ts`:
  - In `markTeamPaid` and `markTeamUnpaid`: `domainEvents.emit({ type: "team.payment_changed", quizId: team.quizId, occurredAt: new Date() })`

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/domain-events-emission.test.ts`  
Expected: PASS.

---

### Task 3: Database Model `CalendarEventMapping` in Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/features/calendar/shared/mappingRepository.ts`
- Test: `tests/features/calendar/mappingRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` client.
- Produces:
  ```typescript
  export interface CalendarEventMappingRepository {
    findByQuizId(quizId: string): Promise<{ id: string; quizId: string; externalEventId: string; calendarId: string } | null>;
    upsertMapping(quizId: string, externalEventId: string, calendarId: string): Promise<void>;
    deleteByQuizId(quizId: string): Promise<void>;
  }
  ```

- [x] **Step 1: Add `CalendarEventMapping` to `prisma/schema.prisma`**

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

- [x] **Step 2: Push schema changes to test database and generate client**

Run: `npx prisma db push`  
Run: `npx prisma generate`

- [x] **Step 3: Write tests for `mappingRepository`**

```typescript
// tests/features/calendar/mappingRepository.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { mappingRepository } from "@/features/calendar/shared/mappingRepository";
import { prisma } from "@/lib/prisma";

describe("CalendarEventMappingRepository", () => {
  beforeEach(async () => {
    await prisma.calendarEventMapping.deleteMany();
  });

  it("returns null when no mapping exists for quizId", async () => {
    const result = await mappingRepository.findByQuizId("quiz-nonexistent");
    expect(result).toBeNull();
  });

  it("upserts and retrieves mapping by quizId", async () => {
    await mappingRepository.upsertMapping("quiz-123", "gcal-event-999", "primary");
    const result = await mappingRepository.findByQuizId("quiz-123");

    expect(result).not.toBeNull();
    expect(result?.externalEventId).toBe("gcal-event-999");
    expect(result?.calendarId).toBe("primary");

    // Re-upsert updates existing mapping
    await mappingRepository.upsertMapping("quiz-123", "gcal-event-updated", "primary");
    const updated = await mappingRepository.findByQuizId("quiz-123");
    expect(updated?.externalEventId).toBe("gcal-event-updated");
  });

  it("deletes mapping cleanly by quizId", async () => {
    await mappingRepository.upsertMapping("quiz-123", "gcal-event-999", "primary");
    await mappingRepository.deleteByQuizId("quiz-123");
    const result = await mappingRepository.findByQuizId("quiz-123");
    expect(result).toBeNull();
  });
});
```

- [x] **Step 4: Implement `mappingRepository.ts`**

In `src/features/calendar/shared/mappingRepository.ts`: implement `findByQuizId`, `upsertMapping` (using `prisma.calendarEventMapping.upsert`), and `deleteByQuizId`.

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/features/calendar/mappingRepository.test.ts`  
Expected: PASS.

---

### Task 4: Shared Calendar Event Formatter (Pure Logic)

**Files:**
- Create: `src/features/calendar/shared/formatter.ts`
- Test: `tests/features/calendar/formatter.test.ts`

**Interfaces:**
- Consumes: Quiz, Team, Lineup names, Payer name, App URL.
- Produces:
  ```typescript
  export interface GoogleCalendarEventPayload {
    summary: string;
    location: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    description: string;
  }

  export function formatGoogleCalendarPayload(params: {
    quiz: { id: string; title: string; startsAt: Date; durationMinutes: number; location: string; timeZone?: string };
    lineup: string[]; // member names
    payment: { fee: string | null; isPaid: boolean; payerName?: string | null };
    appUrl?: string;
  }): GoogleCalendarEventPayload;
  ```

- [x] **Step 1: Write failing unit tests for `formatGoogleCalendarPayload`**

```typescript
// tests/features/calendar/formatter.test.ts
import { describe, it, expect } from "vitest";
import { formatGoogleCalendarPayload } from "@/features/calendar/shared/formatter";

describe("formatGoogleCalendarPayload", () => {
  it("formats title, location, and start/end with Europe/Brussels timezone", () => {
    const startsAt = new Date("2026-11-20T19:00:00.000Z");
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Den Dries Kwies",
        startsAt,
        durationMinutes: 180,
        location: "Kerkstraat 1, 9000 Gent",
      },
      lineup: ["Alice", "Bob", "Charlie", "Dave"],
      payment: { fee: "€20 / ploeg", isPaid: true, payerName: "Marc" },
      appUrl: "https://quiz.example.com",
    });

    expect(result.summary).toBe("Den Dries Kwies");
    expect(result.location).toBe("Kerkstraat 1, 9000 Gent");
    expect(result.start.timeZone).toBe("Europe/Brussels");
    expect(result.end.timeZone).toBe("Europe/Brussels");
    expect(new Date(result.end.dateTime).getTime()).toBe(startsAt.getTime() + 180 * 60000);
  });

  it("formats description with lineup, paid status and payer name", () => {
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Kwies",
        startsAt: new Date("2026-11-20T19:00:00Z"),
        durationMinutes: 120,
        location: "Gent",
      },
      lineup: ["Alice", "Bob"],
      payment: { fee: "€20", isPaid: true, payerName: "Marc" },
      appUrl: "https://quiz.example.com",
    });

    expect(result.description).toContain("Ploeg: Alice, Bob");
    expect(result.description).toContain("Inschrijvingsgeld: €20 (Betaald door Marc)");
    expect(result.description).toContain("https://quiz.example.com/quizzes/quiz-abc");
  });

  it("formats unpaid status correctly when not paid", () => {
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Kwies",
        startsAt: new Date("2026-11-20T19:00:00Z"),
        durationMinutes: 120,
        location: "Gent",
      },
      lineup: ["Alice"],
      payment: { fee: "€25", isPaid: false },
      appUrl: "https://quiz.example.com",
    });

    expect(result.description).toContain("Inschrijvingsgeld: €25 (Nog niet betaald)");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/features/calendar/formatter.test.ts`  
Expected: FAIL with module not found.

- [x] **Step 3: Implement `formatGoogleCalendarPayload` in `src/features/calendar/shared/formatter.ts`**

Implement pure function using ISO formatting for start/end and Dutch text formatting for lineup, payment, and quiz URL.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/features/calendar/formatter.test.ts`  
Expected: PASS.

---

### Task 5: Google Calendar API Client & Service Account Auth

**Files:**
- Create: `src/features/calendar/shared/googleCalendarClient.ts`
- Test: `tests/features/calendar/googleCalendarClient.test.ts`

**Interfaces:**
- Consumes: `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
- Produces:
  ```typescript
  export interface GoogleCalendarClient {
    insertEvent(calendarId: string, payload: GoogleCalendarEventPayload): Promise<{ id: string }>;
    updateEvent(calendarId: string, eventId: string, payload: GoogleCalendarEventPayload): Promise<void>;
    deleteEvent(calendarId: string, eventId: string): Promise<void>;
  }

  export function getGoogleCalendarClient(env?: NodeJS.ProcessEnv): GoogleCalendarClient | null;
  ```

- [x] **Step 1: Write unit tests for Google Calendar Client with mocked API calls**

```typescript
// tests/features/calendar/googleCalendarClient.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGoogleCalendarClient } from "@/features/calendar/shared/googleCalendarClient";

describe("GoogleCalendarClient", () => {
  it("returns null if required env variables are missing", () => {
    const client = getGoogleCalendarClient({});
    expect(client).toBeNull();
  });

  it("unescapes multiline private keys containing literal \\n", () => {
    const env = {
      GOOGLE_CALENDAR_ID: "cal-123",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "sync@test.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n",
    };
    const client = getGoogleCalendarClient(env);
    expect(client).not.toBeNull();
  });

  it("handles 404 / 410 cleanly on deleteEvent without throwing", async () => {
    // Mock fetch/API returning 404
    // verify deleteEvent resolves cleanly
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/features/calendar/googleCalendarClient.test.ts`  
Expected: FAIL.

- [x] **Step 3: Implement `googleCalendarClient.ts`**

Use lightweight OAuth2 JWT exchange or `googleapis` calendar REST endpoint to execute `insert`, `update`, and `delete`. Unescape `\n` in private keys via `.replace(/\\n/g, "\n")`. On `deleteEvent`, catch 404/410 status codes and resolve gracefully.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/features/calendar/googleCalendarClient.test.ts`  
Expected: PASS.

---

### Task 6: Shared Calendar Subscriber & Lifecycle Orchestration

**Files:**
- Create: `src/features/calendar/shared/subscriber.ts`
- Modify: `src/features/calendar/index.ts`
- Test: `tests/features/calendar/subscriber.test.ts`

**Interfaces:**
- Consumes: `domainEvents`, `mappingRepository`, `googleCalendarClient`, `formatGoogleCalendarPayload`.
- Produces:
  ```typescript
  export function registerSharedCalendarSubscriber(): () => void;
  ```

- [x] **Step 1: Write integration tests for the subscriber**

```typescript
// tests/features/calendar/subscriber.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { domainEvents } from "@/lib/events";
import { registerSharedCalendarSubscriber } from "@/features/calendar/shared/subscriber";
import { mappingRepository } from "@/features/calendar/shared/mappingRepository";
import { prisma } from "@/lib/prisma";

describe("Shared Calendar Subscriber", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    domainEvents.clear();
    unsubscribe = registerSharedCalendarSubscriber();
  });

  afterEach(() => {
    unsubscribe();
  });

  it("inserts calendar event on team.registered when no mapping exists", async () => {
    // Emit team.registered
    // Verify client.insertEvent called
    // Verify mappingRepository.upsertMapping called
  });

  it("deletes calendar event on team.registration_cancelled when mapping exists", async () => {
    // Preset mapping in mappingRepository
    // Emit team.registration_cancelled
    // Verify client.deleteEvent called
    // Verify mappingRepository.deleteByQuizId called
  });

  it("updates calendar event on team.roster_changed when mapping exists", async () => {
    // Preset mapping
    // Emit team.roster_changed
    // Verify client.updateEvent called
  });

  it("does nothing on team.roster_changed when no mapping exists (unregistered quiz)", async () => {
    // No mapping
    // Emit team.roster_changed
    // Verify client.updateEvent was NOT called
  });

  it("catches errors and logs to console without throwing when Google API fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Mock client error
    // Emit team.registered
    // Verify no unhandled rejection, console.error was called
    errorSpy.mockRestore();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/features/calendar/subscriber.test.ts`  
Expected: FAIL.

- [x] **Step 3: Implement `registerSharedCalendarSubscriber` in `src/features/calendar/shared/subscriber.ts`**

Attach handlers to:
- `team.registered`: Fetch quiz + team + lineup + payment, check mapping, call `insertEvent` or `updateEvent`, save mapping.
- `team.registration_cancelled`, `quiz.cancelled`: Look up mapping, if found call `deleteEvent` and `deleteByQuizId`.
- `quiz.details_updated`, `team.roster_changed`, `team.payment_changed`: Look up mapping, if found fetch details and call `updateEvent`.
Wrap every handler in `try / catch`, logging with structured tags: `console.error("[GoogleCalendarSync] Error: ", error)`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/features/calendar/subscriber.test.ts`  
Expected: PASS.

---

### Task 7: Capability Registry & Feature Integration Wiring

**Files:**
- Modify: `src/features/capabilities/index.ts`
- Modify: `src/features/calendar/index.ts`
- Modify: `src/instrumentation.ts` (or app server startup to register subscriber when capability is true)
- Test: `tests/features/capabilities.test.ts`

**Interfaces:**
- Consumes: `ENABLE_SHARED_GOOGLE_CALENDAR` environment variable.
- Produces: `AppCapabilities.sharedGoogleCalendar: boolean`.

- [x] **Step 1: Write test asserting `sharedGoogleCalendar` in `getCapabilities`**

```typescript
// tests/features/capabilities.test.ts
import { describe, it, expect } from "vitest";
import { getCapabilities } from "@/features/capabilities";

describe("Capabilities with Shared Google Calendar", () => {
  it("defaults sharedGoogleCalendar to false when env is unset", () => {
    const caps = getCapabilities({});
    expect(caps.sharedGoogleCalendar).toBe(false);
  });

  it("enables sharedGoogleCalendar when ENABLE_SHARED_GOOGLE_CALENDAR is true and credentials exist", () => {
    const caps = getCapabilities({
      ENABLE_SHARED_GOOGLE_CALENDAR: "true",
      GOOGLE_CALENDAR_ID: "cal-1",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "bot@test.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "key",
    });
    expect(caps.sharedGoogleCalendar).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/features/capabilities.test.ts`  
Expected: FAIL (`sharedGoogleCalendar` property missing on `AppCapabilities`).

- [x] **Step 3: Update `AppCapabilities` and hook wiring**

- Add `sharedGoogleCalendar: boolean` to `AppCapabilities` interface in `src/features/capabilities/index.ts`.
- In `src/instrumentation.ts` (Next.js server initialization hook) or server startup module:
  ```typescript
  if (getCapabilities().sharedGoogleCalendar) {
    registerSharedCalendarSubscriber();
  }
  ```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/features/capabilities.test.ts`  
Expected: PASS.

- [x] **Step 5: Run full test suite to verify zero regressions**

Run: `npm test`  
Expected: All tests pass.

---

### Code Review & Remediation (Completed)

- [x] **Critical Fix:** Wired `adminCancelQuizAction` in `src/actions/adminActions.ts` to call `cancelQuiz(quizId)` from `@/services/quizService` so that cancelling a quiz from the admin UI emits `quiz.cancelled` and removes the event from Google Calendar. Added unit test in `tests/admin/adminCancelQuizAction.test.ts`.
- [x] **Important Fix:** Handled HTTP 404/410 cleanly in `googleCalendarClient.updateEvent` to return `{ updated: false, notFound: true }`. In `subscriber.ts`, if an event was deleted directly in Google Calendar, `team.registered` automatically self-heals by recreating the event, and detail/roster updates clean up the stale `CalendarEventMapping`. Added test coverage in `tests/features/calendar/googleCalendarClient.test.ts` and `tests/features/calendar/subscriber.test.ts`.
- [x] **Minor Cleanups:**
  - Standardized Prisma imports to `@/lib/db` and removed redundant `src/lib/prisma.ts`.
  - Added `temp/` to `.gitignore`.
  - Cached the dynamic `import("next/server")` promise lazily at module scope in `src/lib/events/bus.ts`.

