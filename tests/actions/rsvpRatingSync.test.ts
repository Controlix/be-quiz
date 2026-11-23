import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../src/lib/db";
import * as auth from "../../src/lib/auth";
import { submitQuizRating, getQuizRatingSummary } from "../../src/services/ratingService";
import { adminOverrideAttend } from "../../src/services/rsvpService";
import { declineQuizRsvpAction } from "../../src/actions/rsvpActions";
import {
  adminOverrideDeclineAction,
  adminOverrideAttendAction,
} from "../../src/actions/adminActions";
import { QUIZ_LOCKED_RSVP_ERROR } from "../../src/lib/quizLock";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("RSVP Attendee Status & Rating Sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks personal RSVP changes after start and refreshes rating summary when admin overrides attendance", async () => {
    const creator = await prisma.member.create({
      data: { name: `Creator-${Date.now()}`, role: "ADMIN" },
    });
    const p1 = await prisma.member.create({ data: { name: `Marc-${Date.now()}`, role: "USER" } });
    const p2 = await prisma.member.create({ data: { name: `Jef-${Date.now()}`, role: "USER" } });

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

    // Step 1: Both attend (seeded via admin override since quiz has started)
    await adminOverrideAttend(quiz.team!.id, p1.id, creator.id);
    await adminOverrideAttend(quiz.team!.id, p2.id, creator.id);

    // Step 2: Both rate (Marc: 4, Jef: 5)
    await submitQuizRating({ quizId: quiz.id, memberId: p1.id, score: 4 });
    const jefSummary = await submitQuizRating({ quizId: quiz.id, memberId: p2.id, score: 5 });
    expect(jefSummary.average).toBe(4.5);
    expect(jefSummary.count).toBe(2);
    expect(jefSummary.userScore).toBe(5);

    // Step 3: Player Jef cannot self-decline after quiz start
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(p2 as any);
    const lockedDecline = await declineQuizRsvpAction(quiz.team!.id, p2.id, quiz.id);
    expect(lockedDecline).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });

    // Step 4: Admin benches Jef -> only Marc's 4-star rating remains active
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(creator as any);
    const adminDecline = await adminOverrideDeclineAction(quiz.team!.id, p2.id, creator.id);
    expect(adminDecline.success).toBe(true);
    const afterDeclineSummary = await getQuizRatingSummary(quiz.id, p2.id);
    expect(afterDeclineSummary.average).toBe(4);
    expect(afterDeclineSummary.count).toBe(1);
    expect(afterDeclineSummary.totalEligible).toBe(1);
    expect(afterDeclineSummary.userScore).toBeNull();

    // Step 5: Admin reinstates Jef -> his 5-star rating is restored
    const adminRejoin = await adminOverrideAttendAction(quiz.team!.id, p2.id, creator.id);
    expect(adminRejoin.success).toBe(true);
    const afterRejoinSummary = await getQuizRatingSummary(quiz.id, p2.id);
    expect(afterRejoinSummary.average).toBe(4.5);
    expect(afterRejoinSummary.count).toBe(2);
    expect(afterRejoinSummary.totalEligible).toBe(2);
    expect(afterRejoinSummary.userScore).toBe(5);
  });
});
