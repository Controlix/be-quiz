import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";

describe("Guest Rsvp Database Schema", () => {
  it("allows creating an Rsvp with memberId null, guestName, and invitedById", async () => {
    const inviter = await prisma.member.create({
      data: { name: `Inviter-${Date.now()}` },
    });

    const quiz = await prisma.quiz.create({
      data: {
        title: "Guest Schema Test Quiz",
        startsAt: new Date(),
        location: "Test Venue",
        createdById: inviter.id,
      },
    });

    const team = await prisma.team.create({
      data: {
        quizId: quiz.id,
        name: "Test Team",
      },
    });

    const guestRsvp = await prisma.rsvp.create({
      data: {
        teamId: team.id,
        guestName: "Sarah",
        invitedById: inviter.id,
        status: "ATTENDING",
        queuedSince: new Date(),
      },
      include: {
        invitedBy: true,
      },
    });

    expect(guestRsvp.id).toBeDefined();
    expect(guestRsvp.memberId).toBeNull();
    expect(guestRsvp.guestName).toBe("Sarah");
    expect(guestRsvp.invitedById).toBe(inviter.id);
    expect(guestRsvp.invitedBy?.name).toBe(inviter.name);

    // Cleanup
    await prisma.quiz.delete({ where: { id: quiz.id } });
    await prisma.member.delete({ where: { id: inviter.id } });
  });
});
