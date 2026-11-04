# Cross-Chunk Event Bus Singleton & Invariant 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the domain event bus instance and its subscribers persist across Next.js serverless Webpack chunk boundaries using `globalThis`, and formally establish Invariant 8 in architecture documentation.

**Architecture:** Anchor the `domainEvents` broker to `globalThis.__domainEvents__` (following the established Prisma pattern in `src/lib/db.ts`) while keeping it completely agnostic of subscribers. Add an idempotency guard on `globalThis.__calendarSubscriberRegistered__` in the calendar subscriber to protect against warm Lambda re-registration, leaving `src/instrumentation.ts` as the sole Composition Root. Document Invariant 8 in `docs/architecture/overview.md` and repository instructions.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Vitest, Node.js `globalThis`.

---

## Global Constraints

- Never import feature modules (e.g. `calendar`) into `src/lib/events/`. The event bus must remain 100% generic pub/sub.
- `src/instrumentation.ts` remains the single composition root for capabilities-gated subscriber registration.
- No git commits without explicit user consent.
- Strictly update checkboxes (`- [ ]` to `- [x]`) immediately after finishing each step.

---

### Task 1: Write Automated Invariant & Regression Tests

**Files:**
- Create: `tests/unit/events/bus-singleton.test.ts`

**Interfaces:**
- Consumes: `domainEvents` from `@/lib/events`, `registerSharedCalendarSubscriber` from `@/features/calendar`
- Produces: Vitest suite verifying cross-module `globalThis` singleton identity and subscriber registration idempotency.

- [x] **Step 1: Write the failing test**

Create `tests/unit/events/bus-singleton.test.ts` asserting:
1. Accessing `domainEvents` reuses `globalThis.__domainEvents__`.
2. Emitting an event on a re-imported or separate reference triggers handlers registered on `globalThis.__domainEvents__`.
3. Calling `registerSharedCalendarSubscriber()` multiple times attaches event handlers only once (idempotent across warm serverless calls).

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { domainEvents } from "@/lib/events";
import { registerSharedCalendarSubscriber } from "@/features/calendar";

describe("Domain Event Bus Singleton & Subscriber Idempotency", () => {
  beforeEach(() => {
    domainEvents.clear();
    delete (globalThis as any).__domainEvents__;
    delete (globalThis as any).__calendarSubscriberRegistered__;
  });

  it("reuses globalThis.__domainEvents__ across multiple accesses", () => {
    expect((globalThis as any).__domainEvents__).toBeDefined();
    expect(domainEvents).toBe((globalThis as any).__domainEvents__);
  });

  it("registers calendar subscribers idempotently without duplicate handlers", () => {
    const fakeClient = {
      insertEvent: async () => ({ id: "ext-1" }),
      updateEvent: async () => ({ updated: true }),
      deleteEvent: async () => {},
    };

    registerSharedCalendarSubscriber({ client: fakeClient, calendarId: "test-cal" });
    const handlersCount1 = (domainEvents as any).handlers.get("team.registered")?.size || 0;
    expect(handlersCount1).toBe(1);

    // Second call (simulating warm container re-execution)
    registerSharedCalendarSubscriber({ client: fakeClient, calendarId: "test-cal" });
    const handlersCount2 = (domainEvents as any).handlers.get("team.registered")?.size || 0;
    expect(handlersCount2).toBe(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/events/bus-singleton.test.ts`  
Expected: FAIL (because `globalThis.__domainEvents__` is currently undefined).

---

### Task 2: Implement `globalThis` Singleton and Idempotency Guard

**Files:**
- Modify: `src/lib/events/index.ts`
- Modify: `src/features/calendar/shared/subscriber.ts`

**Interfaces:**
- `domainEvents`: `DomainEventBus` singleton exported from `@/lib/events`.
- `registerSharedCalendarSubscriber(options?)`: Idempotent registration function.

- [x] **Step 1: Update `src/lib/events/index.ts`**

Attach `domainEvents` to `globalThis.__domainEvents__`:
```ts
import { EventBus } from "./bus";
import type { DomainEventBus } from "./types";

export * from "./types";
export * from "./bus";

const globalForEvents = globalThis as unknown as {
  __domainEvents__: DomainEventBus | undefined;
};

export const domainEvents: DomainEventBus =
  globalForEvents.__domainEvents__ ??
  (globalForEvents.__domainEvents__ = new EventBus());
```

- [x] **Step 2: Update `src/features/calendar/shared/subscriber.ts`**

Add container-level idempotency on `globalThis.__calendarSubscriberRegistered__`:
```ts
const globalForCalendar = globalThis as unknown as {
  __calendarSubscriberRegistered__?: boolean;
};

export function registerSharedCalendarSubscriber(
  options?: SharedCalendarSubscriberOptions
): () => void {
  if (globalForCalendar.__calendarSubscriberRegistered__) {
    return () => {};
  }

  const client = options?.client ?? getGoogleCalendarClient();
  const calendarId = options?.calendarId ?? process.env.GOOGLE_CALENDAR_ID;

  if (!client || !calendarId) {
    return () => {};
  }

  globalForCalendar.__calendarSubscriberRegistered__ = true;
  ...
```

- [x] **Step 3: Run unit and regression tests**

Run: `npx vitest run tests/unit/events/bus-singleton.test.ts`  
Expected: PASS

Run: `npm test`  
Expected: All 53 test files pass.

Run: `npm run typecheck`  
Expected: Zero TypeScript errors.

---

### Task 3: Document Invariant 8 in Architecture and Agent Rules

**Files:**
- Modify: `docs/architecture/overview.md`
- Modify: `AGENTS.md`

- [x] **Step 1: Update `docs/architecture/overview.md`**

In Section 4.4, document chunk-safe singleton persistence on `globalThis`.  
In Section 5, add **Invariant 8: Cross-Chunk In-Process Singleton Persistence**:
```markdown
8. **Cross-Chunk In-Process Singleton Persistence:** In Next.js server runtimes where Webpack/Turbopack code-splits Server Components, Server Actions, Route Handlers, and Instrumentation into isolated module scopes, any stateful in-process infrastructure intended to be shared across execution boundaries (such as database connection pools or domain event brokers) must be anchored to `globalThis`. Naive file-level `new Service()` singletons are strictly prohibited for shared runtime infrastructure because chunk isolation causes silent state divergence in serverless deployments.
```

- [x] **Step 2: Update `AGENTS.md`**

Add the Cross-Chunk Singleton Invariant under "Uncompromising Architectural Quality & Good Design by Default".

---

### Task 4: Verify Live Production Sync

- [x] **Step 1: Deploy to production (with user consent)**
- [x] **Step 2: Re-register the quiz on `https://be-quiz-six.vercel.app`**
- [x] **Step 3: Verify the event appears in Google Calendar**
