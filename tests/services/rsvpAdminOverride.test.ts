import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, adminOverrideAttend } from "../../src/services/rsvpService";
import { getRsvpLineup } from "../helpers/rsvpLineup";

describe("adminOverrideAttend Service", () => {
  it("re-enrolls a declined player to ATTENDING, updates queuedSince, and records admin audit info", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Attend Override Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
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
    const admin = await prisma.member.create({
      data: { name: `AdminCap-${Date.now()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Full Capacity Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 1,
      },
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

  it("enrolls a never-responded member into reserves when team is full and returns quizId", async () => {
    const admin = await prisma.member.create({
      data: { name: `AdminNever-${Date.now()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Never Responded Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 1,
      },
      admin.id
    );
    const activePlayer = await prisma.member.create({ data: { name: `First-${Date.now()}` } });
    const unresponded = await prisma.member.create({ data: { name: `Silent-${Date.now()}` } });

    await setRsvp(quiz.team!.id, activePlayer.id, "ATTENDING");
    const result = await adminOverrideAttend(quiz.team!.id, unresponded.id, admin.id);

    expect(result).toEqual({ quizId: quiz.id });
    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.map((a) => a.memberId)).toEqual([activePlayer.id]);
    expect(reserves.map((r) => r.memberId)).toEqual([unresponded.id]);
    expect(reserves[0].overriddenById).toBe(admin.id);
  });

  it("preserves existing queuedSince when member is already ATTENDING", async () => {
    const admin = await prisma.member.create({
      data: { name: `AdminPres-${Date.now()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Preserve Queue Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );
    const member = await prisma.member.create({ data: { name: `AlreadyIn-${Date.now()}` } });

    await setRsvp(quiz.team!.id, member.id, "ATTENDING");
    const before = await prisma.rsvp.findUniqueOrThrow({
      where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await adminOverrideAttend(quiz.team!.id, member.id, admin.id);

    const after = await prisma.rsvp.findUniqueOrThrow({
      where: { teamId_memberId: { teamId: quiz.team!.id, memberId: member.id } },
    });
    expect(after.queuedSince?.getTime()).toBe(before.queuedSince?.getTime());
  });
});
