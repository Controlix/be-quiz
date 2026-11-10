import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import {
  getQuizRatingSummary,
  submitQuizRating,
  getBatchQuizRatings,
} from "../../src/services/ratingService";
import { setRsvp } from "../../src/services/rsvpService";

describe("ratingService", () => {
  it("submits a rating for an active player and returns fresh summary", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player1 = await prisma.member.create({ data: { name: `Player1-${Date.now()}` } });
    const player2 = await prisma.member.create({ data: { name: `Player2-${Date.now()}` } });

    // Past quiz (ended 1 hour ago)
    const quiz = await prisma.quiz.create({
      data: {
        title: "Completed Pub Quiz",
        startsAt: new Date(Date.now() - 4 * 3600000),
        durationMinutes: 180,
        location: "Cafe Test",
        createdById: creator.id,
        team: {
          create: {
            name: "Test Team",
            maxTeamSize: 4,
          },
        },
      },
      include: { team: true },
    });

    await setRsvp(quiz.team!.id, player1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, player2.id, "ATTENDING");

    const summary = await submitQuizRating({
      quizId: quiz.id,
      memberId: player1.id,
      score: 5,
    });

    expect(summary.average).toBe(5);
    expect(summary.count).toBe(1);
    expect(summary.totalEligible).toBe(2);
    expect(summary.userScore).toBe(5);

    // Review Focus #5: Upsert/Update behavior
    const updated = await submitQuizRating({
      quizId: quiz.id,
      memberId: player1.id,
      score: 4,
    });
    expect(updated.average).toBe(4);
    expect(updated.count).toBe(1);
    expect(updated.userScore).toBe(4);
  });

  // Review Focus #3: Reject premature rating
  it("rejects rating when quiz has not yet concluded", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player = await prisma.member.create({ data: { name: `Player-${Date.now()}` } });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Future Quiz",
        startsAt: new Date(Date.now() + 3600000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });
    await setRsvp(quiz.team!.id, player.id, "ATTENDING");

    await expect(
      submitQuizRating({ quizId: quiz.id, memberId: player.id, score: 5 })
    ).rejects.toThrow("QUIZ_NOT_CONCLUDED");
  });

  // Review Focus #4: Reject rating cancelled quiz
  it("rejects rating when quiz status is CANCELLED", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player = await prisma.member.create({ data: { name: `Player-${Date.now()}` } });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Cancelled Quiz",
        startsAt: new Date(Date.now() - 36000000),
        status: "CANCELLED",
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });
    await setRsvp(quiz.team!.id, player.id, "ATTENDING");

    await expect(
      submitQuizRating({ quizId: quiz.id, memberId: player.id, score: 5 })
    ).rejects.toThrow("QUIZ_CANCELLED");
  });

  // Review Focus #2: Reject reserve/waitlisted player & Dynamic Lineup Filter
  it("rejects waitlisted reserve player and omits reserve ratings from aggregate summary", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const p1 = await prisma.member.create({ data: { name: `P1-${Date.now()}` } });
    const p2 = await prisma.member.create({ data: { name: `P2-${Date.now()}` } });

    // maxTeamSize = 1
    const quiz = await prisma.quiz.create({
      data: {
        title: "Small Team Quiz",
        startsAt: new Date(Date.now() - 36000000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 1 } },
      },
      include: { team: true },
    });

    await setRsvp(quiz.team!.id, p1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, p2.id, "ATTENDING"); // p2 is on reserve

    await expect(submitQuizRating({ quizId: quiz.id, memberId: p2.id, score: 5 })).rejects.toThrow(
      "NOT_ELIGIBLE"
    );
  });

  // Review Focus #2: Dynamic Lineup Filter (demoted player's rating omitted dynamically)
  it("dynamically excludes rating from aggregate score and userScore when member is demoted to reserve", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const p1 = await prisma.member.create({ data: { name: `P1-${Date.now()}` } });
    const p2 = await prisma.member.create({ data: { name: `P2-${Date.now()}` } });

    // Concluded quiz with maxTeamSize = 1
    const quiz = await prisma.quiz.create({
      data: {
        title: "Demotion Test Quiz",
        startsAt: new Date(Date.now() - 36000000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 1 } },
      },
      include: { team: true },
    });

    // p1 joins first (active lineup) and rates 5 stars
    await setRsvp(quiz.team!.id, p1.id, "ATTENDING");
    const initialSummary = await submitQuizRating({ quizId: quiz.id, memberId: p1.id, score: 5 });
    expect(initialSummary.average).toBe(5);
    expect(initialSummary.count).toBe(1);
    expect(initialSummary.userScore).toBe(5);

    // p2 is inserted ahead of p1 by admin / reorder, demoting p1 to reserve
    await prisma.rsvp.create({
      data: {
        teamId: quiz.team!.id,
        memberId: p2.id,
        status: "ATTENDING",
        queuedSince: new Date(Date.now() - 100000), // queued before p1
      },
    });

    // When fetching summary now: p1 is no longer in active lineup (maxTeamSize = 1)
    const demotedSummary = await getQuizRatingSummary(quiz.id, p1.id);
    expect(demotedSummary.average).toBeNull();
    expect(demotedSummary.count).toBe(0);
    expect(demotedSummary.totalEligible).toBe(1);
    expect(demotedSummary.userScore).toBeNull(); // Private vote hidden while not in active lineup
  });

  it("retrieves batch ratings for multiple quizzes", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player = await prisma.member.create({ data: { name: `Player-${Date.now()}` } });

    const q1 = await prisma.quiz.create({
      data: {
        title: "Batch Q1",
        startsAt: new Date(Date.now() - 36000000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });
    await setRsvp(q1.team!.id, player.id, "ATTENDING");
    await submitQuizRating({ quizId: q1.id, memberId: player.id, score: 4 });

    const batch = await getBatchQuizRatings([q1.id]);
    expect(batch.get(q1.id)).toEqual({ average: 4, count: 1 });
  });

  // Review Focus #1: Reject invalid scores in service
  it("rejects rating with invalid score (0, 6, floating point)", async () => {
    const creator = await prisma.member.create({ data: { name: `Creator-${Date.now()}` } });
    const player = await prisma.member.create({ data: { name: `Player-${Date.now()}` } });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Invalid Score Test",
        startsAt: new Date(Date.now() - 36000000),
        location: "Venue",
        createdById: creator.id,
        team: { create: { name: "Team", maxTeamSize: 4 } },
      },
      include: { team: true },
    });
    await setRsvp(quiz.team!.id, player.id, "ATTENDING");

    await expect(
      submitQuizRating({ quizId: quiz.id, memberId: player.id, score: 0 })
    ).rejects.toThrow("Beoordeling moet een geheel getal zijn van 1 tot 5.");

    await expect(
      submitQuizRating({ quizId: quiz.id, memberId: player.id, score: 6 })
    ).rejects.toThrow("Beoordeling moet een geheel getal zijn van 1 tot 5.");

    await expect(
      submitQuizRating({ quizId: quiz.id, memberId: player.id, score: 3.5 })
    ).rejects.toThrow("Beoordeling moet een geheel getal zijn van 1 tot 5.");
  });
});
