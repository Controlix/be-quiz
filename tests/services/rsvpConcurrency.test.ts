import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup } from "../../src/services/rsvpService";

describe("RSVP Concurrency & FIFO Waitlist", () => {
  it("enforces FIFO queue and handles concurrent RSVPs at capacity limit", async () => {
    const admin = await prisma.member.create({ data: { name: "Admin", role: "ADMIN" } });
    const quiz = await createQuiz(
      {
        title: "Concurrency Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 2,
      },
      admin.id
    );

    const m1 = await prisma.member.create({ data: { name: "Player 1" } });
    const m2 = await prisma.member.create({ data: { name: "Player 2" } });
    const m3 = await prisma.member.create({ data: { name: "Player 3" } });

    await Promise.all([
      setRsvp(quiz.team!.id, m1.id, "ATTENDING"),
      setRsvp(quiz.team!.id, m2.id, "ATTENDING"),
      setRsvp(quiz.team!.id, m3.id, "ATTENDING"),
    ]);

    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(2);
    expect(reserves.length).toBe(1);

    await setRsvp(quiz.team!.id, active[0].memberId, "DECLINED");
    const updated = await getRsvpLineup(quiz.team!.id);
    expect(updated.active.length).toBe(2);
    expect(updated.reserves.length).toBe(0);
    expect(updated.active.map((a) => a.memberId)).toContain(reserves[0].memberId);
  });
});
