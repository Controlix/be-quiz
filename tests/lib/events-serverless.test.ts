import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAfter = vi.fn();
vi.mock("next/server", () => ({
  after: (task: any) => mockAfter(task),
}));

import { domainEvents } from "@/lib/events";

describe("DomainEventBus Serverless Coordination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    domainEvents.clear();
  });

  it("schedules async handlers with Next.js after() when in request context", async () => {
    const asyncHandler = vi.fn().mockResolvedValue("done");
    domainEvents.subscribe("team.registered", asyncHandler);

    domainEvents.emit({
      type: "team.registered",
      quizId: "quiz-1",
      occurredAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockAfter).toHaveBeenCalledWith(expect.any(Function));
  });

  it("safely falls back without throwing when after() throws outside request scope", async () => {
    mockAfter.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });

    const asyncHandler = vi.fn().mockResolvedValue("done");
    domainEvents.subscribe("team.registered", asyncHandler);

    expect(() => {
      domainEvents.emit({
        type: "team.registered",
        quizId: "quiz-1",
        occurredAt: new Date(),
      });
    }).not.toThrow();

    expect(asyncHandler).toHaveBeenCalledTimes(1);
  });
});
