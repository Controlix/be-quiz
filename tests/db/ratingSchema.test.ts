import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";

describe("QuizRating Database Model", () => {
  it("creates a quiz rating and verifies cascade deletion on quiz removal", async () => {
    const member = await prisma.member.create({
      data: { name: `RatingUser-${Date.now()}` },
    });

    const quiz = await prisma.quiz.create({
      data: {
        title: "Rating Schema Test Quiz",
        startsAt: new Date(Date.now() - 3600000),
        location: "Test Venue",
        createdById: member.id,
      },
    });

    const rating = await prisma.quizRating.create({
      data: {
        quizId: quiz.id,
        memberId: member.id,
        score: 5,
      },
    });

    expect(rating.id).toBeDefined();
    expect(rating.score).toBe(5);

    // Verify cascade deletion
    await prisma.quiz.delete({ where: { id: quiz.id } });
    const orphanRating = await prisma.quizRating.findUnique({
      where: { id: rating.id },
    });
    expect(orphanRating).toBeNull();
  });
});
