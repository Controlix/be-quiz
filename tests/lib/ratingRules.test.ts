import { describe, it, expect } from "vitest";
import {
  isQuizConcluded,
  validateRatingScore,
  computeRatingSummary,
} from "../../src/lib/ratingRules";

describe("ratingRules Pure Helpers", () => {
  it("determines if quiz is concluded based on startsAt + durationMinutes", () => {
    const baseTime = new Date("2026-11-10T20:00:00Z");
    const duration = 120; // ends at 22:00:00Z

    // Review Focus #3: Premature / ongoing quiz check
    expect(isQuizConcluded(baseTime, duration, new Date("2026-11-10T21:59:59Z"))).toBe(false);
    expect(isQuizConcluded(baseTime, duration, new Date("2026-11-10T22:00:00Z"))).toBe(true);
    expect(isQuizConcluded(baseTime, duration, new Date("2026-11-10T22:01:00Z"))).toBe(true);
  });

  // Review Focus #1: Score boundary and type violations
  it("validates score must be an integer between 1 and 5", () => {
    expect(validateRatingScore(1).valid).toBe(true);
    expect(validateRatingScore(5).valid).toBe(true);
    expect(validateRatingScore(0).valid).toBe(false);
    expect(validateRatingScore(6).valid).toBe(false);
    expect(validateRatingScore(3.5).valid).toBe(false);
    expect(validateRatingScore("4").valid).toBe(false);
    expect(validateRatingScore(null).valid).toBe(false);
  });

  it("computes rating summary strictly for active member ratings and rounds to 1 decimal", () => {
    const activeMemberIds = ["m1", "m2", "m3", "m4"];
    const ratings = [
      { memberId: "m1", score: 5 },
      { memberId: "m2", score: 4 },
      { memberId: "m3", score: 4 },
      // Review Focus #2: Reserve member rating excluded dynamically
      { memberId: "reserve-m5", score: 1 },
    ];

    const summary = computeRatingSummary({
      ratings,
      activeMemberIds,
      currentMemberId: "m1",
    });

    // (5 + 4 + 4) / 3 = 4.3333... => rounded to 4.3
    expect(summary.average).toBe(4.3);
    expect(summary.count).toBe(3);
    expect(summary.totalEligible).toBe(4);
    expect(summary.userScore).toBe(5);
  });

  it("returns userScore as null when current member is not in active lineup", () => {
    const summary = computeRatingSummary({
      ratings: [{ memberId: "m1", score: 5 }],
      activeMemberIds: ["m1"],
      currentMemberId: "m2",
    });
    expect(summary.userScore).toBeNull();
  });

  it("returns average null when count is 0", () => {
    const summary = computeRatingSummary({
      ratings: [],
      activeMemberIds: ["m1", "m2"],
    });
    expect(summary.average).toBeNull();
    expect(summary.count).toBe(0);
    expect(summary.totalEligible).toBe(2);
    expect(summary.userScore).toBeNull();
  });
});
