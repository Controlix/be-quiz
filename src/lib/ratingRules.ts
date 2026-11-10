export interface QuizRatingSummary {
  average: number | null;
  count: number;
  totalEligible: number;
  userScore: number | null;
}

/**
 * Checks whether a quiz has concluded based on startsAt + durationMinutes.
 */
export function isQuizConcluded(
  startsAt: Date,
  durationMinutes: number,
  now: Date = new Date()
): boolean {
  const concludesAt = new Date(startsAt).getTime() + durationMinutes * 60 * 1000;
  return now.getTime() >= concludesAt;
}

/**
 * Validates that a rating score is an integer between 1 and 5.
 */
export function validateRatingScore(score: unknown): { valid: boolean; error?: string } {
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
    return {
      valid: false,
      error: "Beoordeling moet een geheel getal zijn van 1 tot 5.",
    };
  }
  return { valid: true };
}

/**
 * Computes rating summary strictly for active lineup players.
 * Dynamically excludes votes from members who are no longer in active lineup.
 */
export function computeRatingSummary(params: {
  ratings: Array<{ memberId: string; score: number }>;
  activeMemberIds: string[];
  currentMemberId?: string;
}): QuizRatingSummary {
  const { ratings, activeMemberIds, currentMemberId } = params;
  const activeSet = new Set(activeMemberIds);

  const eligibleRatings = ratings.filter((r) => activeSet.has(r.memberId));
  const count = eligibleRatings.length;
  const totalEligible = activeMemberIds.length;

  let average: number | null = null;
  if (count > 0) {
    const sum = eligibleRatings.reduce((acc, curr) => acc + curr.score, 0);
    average = Math.round((sum / count) * 10) / 10;
  }

  let userScore: number | null = null;
  if (currentMemberId && activeSet.has(currentMemberId)) {
    const userRating = eligibleRatings.find((r) => r.memberId === currentMemberId);
    userScore = userRating ? userRating.score : null;
  }

  return {
    average,
    count,
    totalEligible,
    userScore,
  };
}
