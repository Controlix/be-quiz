import { describe, it, expect, vi, beforeEach } from "vitest";
import * as auth from "../../src/lib/auth";
import * as ratingService from "../../src/services/ratingService";
import { rateQuizAction } from "../../src/actions/ratingActions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("rateQuizAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if user is unauthenticated", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);

    const result = await rateQuizAction("quiz-123", 5);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Niet ingelogd");
    }
  });

  it("submits rating and triggers revalidations when user is authenticated", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({
      id: "member-1",
      name: "Marc",
      role: "USER",
      pinHash: null,
      createdAt: new Date(),
    });

    const mockSummary = { average: 5, count: 1, totalEligible: 4, userScore: 5 };
    vi.spyOn(ratingService, "submitQuizRating").mockResolvedValue(mockSummary);

    const result = await rateQuizAction("quiz-123", 5);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.summary).toEqual(mockSummary);
    }
  });
});
