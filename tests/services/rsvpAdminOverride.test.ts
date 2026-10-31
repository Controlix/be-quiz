import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup, adminOverrideDecline, adminOverrideAttend } from "../../src/services/rsvpService";

describe("adminOverrideAttend Service", () => {
  it("re-enrolls a declined player to ATTENDING, updates queuedSince, and records admin audit info", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz(
      { title: "Attend Override Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 4 },
      admin.id
    );
    const member = await prisma.member.create({ data: { name: `DeclinedPlayer-${Date.now()}` } });

    // Step 1: Member declines
    await setRsvp(quiz.team!.id, member.id, "DECLINED");
    const rsvpDeclined = await prisma.rsvp.findUnique({
      where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
    });
    expect(rsvpDeclined?.status).toBe("DECLINED");

    // Step 2: Admin overrides to attend
    await adminOverrideAttend(quiz.team!.id, member.id, admin.id);
    const rsvpAttending = await prisma.rsvp.findUnique({
      where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
    });
    expect(rsvpAttending?.status).toBe("ATTENDING");
    expect(rsvpAttending?.queuedSince).toBeInstanceOf(Date);
    expect(rsvpAttending?.overriddenById).toBe(admin.id);
    expect(rsvpAttending?.overriddenAt).toBeInstanceOf(Date);

    // Step 3: Verify they appear in the lineup
    const { active } = await getRsvpLineup(quiz.team!.id);
    expect(active.some((a) => a.memberId === member.id)).toBe(true);
  });

  // Review Focus #1: Capacity check
  it("places re-enrolled player into reserves when active spots are full", async () => {
    const admin = await prisma.member.create({ data: { name: `AdminCap-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz(
      { title: "Full Capacity Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 1 },
      admin.id
    );
    const m1 = await prisma.member.create({ data: { name: `Active1-${Date.now()}` } });
    const m2 = await prisma.member.create({ data: { name: `Reserve1-${Date.now()}` } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "DECLINED");

    await adminOverrideAttend(quiz.team!.id, m2.id, admin.id);
    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(1);
    expect(active[0].memberId).toBe(m1.id);
    expect(reserves.length).toBe(1);
    expect(reserves[0].memberId).toBe(m2.id);
  });
});
