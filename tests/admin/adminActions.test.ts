import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup, adminOverrideDecline, updateTeamCapacity } from "../../src/services/rsvpService";

describe("Admin Override & Capacity Demotion Logic", () => {
  // Review Focus #2: Admin RSVP Override Audit & Promotion
  it("audits admin decline overrides and promotes the earliest reserve", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz(
      { title: "Admin Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 1 },
      admin.id
    );
    const m1 = await prisma.member.create({ data: { name: `Player 1-${Date.now()}` } });
    const m2 = await prisma.member.create({ data: { name: `Player 2-${Date.now()}` } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "ATTENDING");

    await adminOverrideDecline(quiz.team!.id, m1.id, admin.id);
    const rsvp1 = await prisma.rsvp.findUnique({
      where: { teamId_memberId: { teamId: quiz.team!.id, memberId: m1.id } },
    });
    expect(rsvp1?.status).toBe("DECLINED");
    expect(rsvp1?.overriddenById).toBe(admin.id);
    expect(rsvp1?.overriddenAt).not.toBeNull();

    const { active } = await getRsvpLineup(quiz.team!.id);
    expect(active[0].memberId).toBe(m2.id);
  });

  // Review Focus #3: Lowering maxTeamSize Demotion
  it("demotes latest attendee to reserve #1 while preserving queuedSince when maxTeamSize is reduced", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin2-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz(
      { title: "Capacity Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 2 },
      admin.id
    );
    const m1 = await prisma.member.create({ data: { name: `Player A-${Date.now()}` } });
    const m2 = await prisma.member.create({ data: { name: `Player B-${Date.now()}` } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "ATTENDING");

    await updateTeamCapacity(quiz.team!.id, 1);
    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(1);
    expect(active[0].memberId).toBe(m1.id);
    expect(reserves.length).toBe(1);
    expect(reserves[0].memberId).toBe(m2.id);
  });
});
