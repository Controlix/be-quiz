import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup, reorderRsvps } from "../../src/services/rsvpService";

describe("Admin Roster Reordering", () => {
  it("reorders attendees and updates active lineup and reserve boundary", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz({ title: "Reorder Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 2 }, admin.id);
    const m1 = await prisma.member.create({ data: { name: `M1-${Date.now()}` } });
    const m2 = await prisma.member.create({ data: { name: `M2-${Date.now()}` } });
    const m3 = await prisma.member.create({ data: { name: `M3-${Date.now()}` } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m3.id, "ATTENDING"); // Reserve #1

    // Admin drags M3 (reserve #1, index 2) to slot 0 (active lineup)
    await reorderRsvps(quiz.team!.id, 2, 0);

    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active[0].memberId).toBe(m3.id);
    expect(reserves[0].memberId).toBe(m2.id);
  });
});
