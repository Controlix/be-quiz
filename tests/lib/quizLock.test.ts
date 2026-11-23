import { describe, it, expect } from "vitest";
import { isPersonalRsvpLocked, isQuizLockedForUser } from "../../src/lib/quizLock";

describe("quizLock domain helper", () => {
  const start = new Date("2026-11-22T20:00:00.000Z");

  it("returns false before startsAt for OPEN quizzes", () => {
    const before = new Date("2026-11-22T19:59:59.999Z");
    const quiz = { startsAt: start, status: "OPEN" as const };

    expect(isPersonalRsvpLocked(quiz, before)).toBe(false);
    expect(isQuizLockedForUser(quiz, "USER", before)).toBe(false);
    expect(isQuizLockedForUser(quiz, "ADMIN", before)).toBe(false);
  });

  // Review Focus #1: Exact startsAt boundary
  it("locks personal RSVP and regular users at exact startsAt timestamp while keeping ADMIN unlocked", () => {
    const exactStart = new Date("2026-11-22T20:00:00.000Z");
    const quiz = { startsAt: start, status: "OPEN" as const };

    expect(isPersonalRsvpLocked(quiz, exactStart)).toBe(true);
    expect(isQuizLockedForUser(quiz, "USER", exactStart)).toBe(true);
    expect(isQuizLockedForUser(quiz, "ADMIN", exactStart)).toBe(false);
  });

  it("locks personal RSVP and regular users after startsAt while keeping ADMIN unlocked", () => {
    const after = new Date("2026-11-22T20:05:00.000Z");
    const quiz = { startsAt: start, status: "OPEN" as const };

    expect(isPersonalRsvpLocked(quiz, after)).toBe(true);
    expect(isQuizLockedForUser(quiz, "USER", after)).toBe(true);
    expect(isQuizLockedForUser(quiz, "ADMIN", after)).toBe(false);
  });

  // Review Focus #2: CANCELLED and ARCHIVED quizzes before startsAt
  it("locks CANCELLED and ARCHIVED quizzes even when startsAt is in the future, except for ADMIN management", () => {
    const before = new Date("2026-11-22T18:00:00.000Z");

    expect(isPersonalRsvpLocked({ startsAt: start, status: "CANCELLED" }, before)).toBe(true);
    expect(isPersonalRsvpLocked({ startsAt: start, status: "ARCHIVED" }, before)).toBe(true);
    expect(isQuizLockedForUser({ startsAt: start, status: "CANCELLED" }, "USER", before)).toBe(
      true
    );
    expect(isQuizLockedForUser({ startsAt: start, status: "ARCHIVED" }, "USER", before)).toBe(true);
    expect(isQuizLockedForUser({ startsAt: start, status: "CANCELLED" }, "ADMIN", before)).toBe(
      false
    );
    expect(isQuizLockedForUser({ startsAt: start, status: "ARCHIVED" }, "ADMIN", before)).toBe(
      false
    );
  });

  it("accepts ISO string startsAt values from serialized RSC payloads", () => {
    const after = new Date("2026-11-22T21:00:00.000Z");
    expect(isPersonalRsvpLocked({ startsAt: "2026-11-22T20:00:00.000Z" }, after)).toBe(true);
  });
});
