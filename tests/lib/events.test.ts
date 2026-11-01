import { describe, it, expect, vi, beforeEach } from "vitest";
import { domainEvents } from "@/lib/events";

describe("DomainEventBus", () => {
  beforeEach(() => {
    domainEvents.clear();
  });

  it("calls subscriber when subscribed event is emitted", () => {
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

  it("isolates errors so a throwing subscriber does not break other subscribers or emit caller", () => {
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
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("isolates errors from async rejecting subscribers", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const faultyAsyncHandler = vi.fn().mockRejectedValue(new Error("Async rejection"));
    const goodHandler = vi.fn();

    domainEvents.subscribe("team.registered", faultyAsyncHandler);
    domainEvents.subscribe("team.registered", goodHandler);

    expect(() => {
      domainEvents.emit({ type: "team.registered", quizId: "quiz-1", occurredAt: new Date() });
    }).not.toThrow();

    expect(goodHandler).toHaveBeenCalledTimes(1);
    // Allow any pending microtasks to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(errorSpy).toHaveBeenCalled();
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
