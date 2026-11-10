import { prisma } from "@/lib/db";
import {
  isQuizConcluded,
  validateRatingScore,
  computeRatingSummary,
  QuizRatingSummary,
} from "@/lib/ratingRules";

export type { QuizRatingSummary };

/**
 * Retrieves the aggregate rating summary for a quiz, filtering strictly for active lineup attendees.
 */
export async function getQuizRatingSummary(
  quizId: string,
  currentMemberId?: string
): Promise<QuizRatingSummary> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      team: {
        include: {
          rsvps: {
            where: { status: "ATTENDING" },
            orderBy: { queuedSince: "asc" },
          },
        },
      },
      ratings: true,
    },
  });

  if (!quiz) {
    return {
      average: null,
      count: 0,
      totalEligible: 0,
      userScore: null,
    };
  }

  const maxTeamSize = quiz.team?.maxTeamSize || 4;
  const activeMemberIds = (quiz.team?.rsvps || []).slice(0, maxTeamSize).map((r) => r.memberId);

  return computeRatingSummary({
    ratings: quiz.ratings,
    activeMemberIds,
    currentMemberId,
  });
}

/**
 * Submits or updates a rating for an active lineup member after quiz conclusion.
 */
export async function submitQuizRating(params: {
  quizId: string;
  memberId: string;
  score: number;
}): Promise<QuizRatingSummary> {
  const { quizId, memberId, score } = params;

  const validation = validateRatingScore(score);
  if (!validation.valid) {
    throw new Error(validation.error || "INVALID_SCORE");
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      team: {
        include: {
          rsvps: {
            where: { status: "ATTENDING" },
            orderBy: { queuedSince: "asc" },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new Error("QUIZ_NOT_FOUND");
  }

  if (quiz.status === "CANCELLED") {
    throw new Error("QUIZ_CANCELLED");
  }

  if (!isQuizConcluded(quiz.startsAt, quiz.durationMinutes)) {
    throw new Error("QUIZ_NOT_CONCLUDED");
  }

  const maxTeamSize = quiz.team?.maxTeamSize || 4;
  const activeMemberIds = (quiz.team?.rsvps || []).slice(0, maxTeamSize).map((r) => r.memberId);

  if (!activeMemberIds.includes(memberId)) {
    throw new Error("NOT_ELIGIBLE");
  }

  await prisma.quizRating.upsert({
    where: {
      quizId_memberId: {
        quizId,
        memberId,
      },
    },
    update: { score },
    create: {
      quizId,
      memberId,
      score,
    },
  });

  return getQuizRatingSummary(quizId, memberId);
}

/**
 * Batches rating lookups across multiple quizzes for dashboard display.
 */
export async function getBatchQuizRatings(
  quizIds: string[]
): Promise<Map<string, { average: number; count: number }>> {
  if (quizIds.length === 0) {
    return new Map();
  }

  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: quizIds } },
    select: {
      id: true,
      team: {
        select: {
          maxTeamSize: true,
          rsvps: {
            where: { status: "ATTENDING" },
            select: { memberId: true },
            orderBy: { queuedSince: "asc" },
          },
        },
      },
      ratings: {
        select: {
          memberId: true,
          score: true,
        },
      },
    },
  });

  const result = new Map<string, { average: number; count: number }>();

  for (const quiz of quizzes) {
    const maxTeamSize = quiz.team?.maxTeamSize || 4;
    const activeMemberIds = (quiz.team?.rsvps || []).slice(0, maxTeamSize).map((r) => r.memberId);
    const summary = computeRatingSummary({
      ratings: quiz.ratings,
      activeMemberIds,
    });

    if (summary.average !== null && summary.count > 0) {
      result.set(quiz.id, { average: summary.average, count: summary.count });
    }
  }

  return result;
}
