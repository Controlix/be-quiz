import { describe, it, expect, beforeEach } from "vitest";
import { domainEvents } from "@/lib/events";
import { registerSharedCalendarSubscriber } from "@/features/calendar";

describe("Domain Event Bus Singleton & Subscriber Idempotency", () => {
  beforeEach(() => {
    domainEvents.clear();
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

  it("dispatches events across globalThis.__domainEvents__", () => {
    let received = false;
    const bus = (globalThis as any).__domainEvents__;
    bus.subscribe("team.registered", () => {
      received = true;
    });

    domainEvents.emit({
      type: "team.registered",
      quizId: "test-quiz",
      occurredAt: new Date(),
    });

    expect(received).toBe(true);
  });
});
