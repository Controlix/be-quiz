import { describe, it, expect, vi } from "vitest";
import { prisma } from "../../src/lib/db";
import { submitQuizRating } from "../../src/services/ratingService";
import { joinQuizRsvpAction, declineQuizRsvpAction } from "../../src/actions/rsvpActions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("RSVP Attendee Status & Rating Sync", () => {
  it("refreshes rating summary when attendee declines and restores private vote when re-joining", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const p1 = await prisma.member.create({ data: { name: `Marc-${Date.now()}` } });
    const p2 = await prisma.member.create({ data: { name: `Jef-${Date.now()}` } });

    // Concluded quiz
    const quiz = await prisma.quiz.create({
      data: {
        title: "Sync Test Quiz",
        startsAt: new Date(Date.now() - 36000000),
        durationMinutes: 180,
        location: "Pub",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });

    // Step 1: Both attend
    await joinQuizRsvpAction(quiz.team!.id, p1.id, quiz.id);
    await joinQuizRsvpAction(quiz.team!.id, p2.id, quiz.id);

    // Step 2: Both rate (Marc: 4, Jef: 5)
    await submitQuizRating({ quizId: quiz.id, memberId: p1.id, score: 4 });
    const jefSummary = await submitQuizRating({ quizId: quiz.id, memberId: p2.id, score: 5 });
    expect(jefSummary.average).toBe(4.5);
    expect(jefSummary.count).toBe(2);
    expect(jefSummary.userScore).toBe(5);

    // Step 3: Jef declines ("Kan niet")
    const declineResult = await declineQuizRsvpAction(quiz.team!.id, p2.id, quiz.id);
    expect(declineResult.success).toBe(true);
    expect(declineResult.ratingSummary).toBeDefined();
    // With Jef declined, only Marc's 4-star rating is active:
    expect(declineResult.ratingSummary?.average).toBe(4);
    expect(declineResult.ratingSummary?.count).toBe(1);
    expect(declineResult.ratingSummary?.totalEligible).toBe(1);
    expect(declineResult.ratingSummary?.userScore).toBeNull();

    // Step 4: Jef re-joins ("Ik doe mee")
    const rejoinResult = await joinQuizRsvpAction(quiz.team!.id, p2.id, quiz.id);
    expect(rejoinResult.success).toBe(true);
    expect(rejoinResult.ratingSummary).toBeDefined();
    // With Jef attending again, his 5-star rating is restored:
    expect(rejoinResult.ratingSummary?.average).toBe(4.5);
    expect(rejoinResult.ratingSummary?.count).toBe(2);
    expect(rejoinResult.ratingSummary?.totalEligible).toBe(2);
    expect(rejoinResult.ratingSummary?.userScore).toBe(5);
  });
});
