import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../src/lib/db";
import * as auth from "../../src/lib/auth";
import { joinQuizRsvpAction, declineQuizRsvpAction } from "../../src/actions/rsvpActions";
import { setRegisteredAction, toggleFeePaidAction } from "../../src/actions/registrationActions";
import { addGuestAction, removeGuestAction } from "../../src/actions/guestActions";
import {
  adminOverrideDeclineAction,
  adminOverrideAttendAction,
} from "../../src/actions/adminActions";
import { adminReorderRsvpAction } from "../../src/actions/reorderActions";
import { QUIZ_LOCKED_RSVP_ERROR, QUIZ_LOCKED_MUTATION_ERROR } from "../../src/lib/quizLock";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Quiz Start Lockdown Server Enforcement", () => {
  let regularUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let adminUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let futureQuiz: { id: string; team: { id: string } };
  let startedQuiz: { id: string; team: { id: string } };
  let cancelledFutureQuiz: { id: string; team: { id: string } };
  let archivedFutureQuiz: { id: string; team: { id: string } };

  beforeEach(async () => {
    vi.restoreAllMocks();
    const suffix = `${Date.now()}-${Math.random()}`;

    regularUser = await prisma.member.create({
      data: { name: `User-${suffix}`, role: "USER" },
    });
    adminUser = await prisma.member.create({
      data: { name: `Admin-${suffix}`, role: "ADMIN" },
    });

    futureQuiz = (await prisma.quiz.create({
      data: {
        title: "Future Open Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    })) as any;

    startedQuiz = (await prisma.quiz.create({
      data: {
        title: "Started Quiz",
        startsAt: new Date(Date.now() - 60000),
        location: "Antwerpen",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 1 } },
      },
      include: { team: true },
    })) as any;

    cancelledFutureQuiz = (await prisma.quiz.create({
      data: {
        title: "Cancelled Future Quiz",
        startsAt: new Date(Date.now() + 86400000),
        status: "CANCELLED",
        location: "Brugge",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    })) as any;

    archivedFutureQuiz = (await prisma.quiz.create({
      data: {
        title: "Archived Future Quiz",
        startsAt: new Date(Date.now() + 86400000),
        status: "ARCHIVED",
        location: "Leuven",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    })) as any;
  });

  // Review Focus #4: Unauthenticated RPC rejection
  it("rejects unauthenticated requests for RSVP, registration, payment, and guest actions", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);

    const joinRes = await joinQuizRsvpAction(futureQuiz.team.id, regularUser.id, futureQuiz.id);
    const declineRes = await declineQuizRsvpAction(
      futureQuiz.team.id,
      regularUser.id,
      futureQuiz.id
    );
    const regRes = await setRegisteredAction(futureQuiz.team.id, regularUser.id);
    const payRes = await toggleFeePaidAction(futureQuiz.team.id, regularUser.id);
    const addGuestRes = await addGuestAction(futureQuiz.team.id, "Sarah");
    const removeGuestRes = await removeGuestAction("non-existent-rsvp-id", futureQuiz.team.id);

    expect(joinRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(declineRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(regRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(payRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(addGuestRes).toEqual({ success: false, error: "Niet ingelogd" });
    expect(removeGuestRes).toEqual({ success: false, error: "Niet ingelogd" });
  });

  // Review Focus #3: Personal RSVP frozen for ALL members (including ADMIN) after startsAt
  it("blocks personal RSVP join/decline for both USER and ADMIN once quiz has started", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const userJoin = await joinQuizRsvpAction(startedQuiz.team.id, regularUser.id, startedQuiz.id);
    const userDecline = await declineQuizRsvpAction(
      startedQuiz.team.id,
      regularUser.id,
      startedQuiz.id
    );

    expect(userJoin).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });
    expect(userDecline).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
    const adminJoin = await joinQuizRsvpAction(startedQuiz.team.id, adminUser.id, startedQuiz.id);
    const adminDecline = await declineQuizRsvpAction(
      startedQuiz.team.id,
      adminUser.id,
      startedQuiz.id
    );

    expect(adminJoin).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });
    expect(adminDecline).toEqual({ success: false, error: QUIZ_LOCKED_RSVP_ERROR });
  });

  // Review Focus #2: CANCELLED and ARCHIVED quizzes before startsAt
  it("enforces lockdown on CANCELLED and ARCHIVED future quizzes for USER and personal ADMIN RSVPs while allowing ADMIN management", async () => {
    for (const lockedQuiz of [cancelledFutureQuiz, archivedFutureQuiz]) {
      vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
      expect(await joinQuizRsvpAction(lockedQuiz.team.id, regularUser.id, lockedQuiz.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_RSVP_ERROR,
      });
      expect(await setRegisteredAction(lockedQuiz.team.id, regularUser.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_MUTATION_ERROR,
      });
      expect(await toggleFeePaidAction(lockedQuiz.team.id, regularUser.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_MUTATION_ERROR,
      });
      expect(await addGuestAction(lockedQuiz.team.id, "Gast")).toEqual({
        success: false,
        error: QUIZ_LOCKED_MUTATION_ERROR,
      });

      vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
      expect(await joinQuizRsvpAction(lockedQuiz.team.id, adminUser.id, lockedQuiz.id)).toEqual({
        success: false,
        error: QUIZ_LOCKED_RSVP_ERROR,
      });
      expect(await setRegisteredAction(lockedQuiz.team.id, adminUser.id)).toEqual({
        success: true,
      });
      expect(
        await adminOverrideAttendAction(lockedQuiz.team.id, regularUser.id, adminUser.id)
      ).toEqual({
        success: true,
      });
    }
  });

  // Review Focus #4: Non-admin guest removal blocked on both active and reserve entries when locked
  it("blocks non-admin inviter from removing active or reserve guests once quiz has started", async () => {
    const activeGuest = await prisma.rsvp.create({
      data: {
        teamId: startedQuiz.team.id,
        guestName: "ActiveGast",
        invitedById: regularUser.id,
        status: "ATTENDING",
        queuedSince: new Date(1000),
      },
    });
    const reserveGuest = await prisma.rsvp.create({
      data: {
        teamId: startedQuiz.team.id,
        guestName: "ReserveGast",
        invitedById: regularUser.id,
        status: "ATTENDING",
        queuedSince: new Date(2000),
      },
    });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    expect(await removeGuestAction(activeGuest.id, startedQuiz.team.id)).toEqual({
      success: false,
      error: QUIZ_LOCKED_MUTATION_ERROR,
    });
    expect(await removeGuestAction(reserveGuest.id, startedQuiz.team.id)).toEqual({
      success: false,
      error: QUIZ_LOCKED_MUTATION_ERROR,
    });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
    expect(await removeGuestAction(reserveGuest.id, startedQuiz.team.id)).toEqual({
      success: true,
    });
  });

  it("allows personal RSVP on an OPEN future quiz and uses sessionMember.id", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const res = await joinQuizRsvpAction(futureQuiz.team.id, "spoofed-id", futureQuiz.id);
    expect(res.success).toBe(true);

    const saved = await prisma.rsvp.findUnique({
      where: { teamId_memberId: { teamId: futureQuiz.team.id, memberId: regularUser.id } },
    });
    expect(saved?.status).toBe("ATTENDING");
  });

  it("blocks registration and payment toggles for regular USER after startsAt, but allows ADMIN", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const userReg = await setRegisteredAction(startedQuiz.team.id, regularUser.id);
    const userPay = await toggleFeePaidAction(startedQuiz.team.id, regularUser.id);
    expect(userReg).toEqual({ success: false, error: QUIZ_LOCKED_MUTATION_ERROR });
    expect(userPay).toEqual({ success: false, error: QUIZ_LOCKED_MUTATION_ERROR });

    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
    const adminReg = await setRegisteredAction(startedQuiz.team.id, adminUser.id);
    const adminPay = await toggleFeePaidAction(startedQuiz.team.id, adminUser.id);
    expect(adminReg).toEqual({ success: true });
    expect(adminPay).toEqual({ success: true, isPaid: true });
  });

  it("allows regular USER to toggle registration and payment before startsAt", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const userReg = await setRegisteredAction(futureQuiz.team.id, regularUser.id);
    const userPay = await toggleFeePaidAction(futureQuiz.team.id, regularUser.id);
    expect(userReg).toEqual({ success: true });
    expect(userPay).toEqual({ success: true, isPaid: true });
  });

  it("keeps admin lineup overrides and reorder executable after startsAt", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);

    const attendRes = await adminOverrideAttendAction(
      startedQuiz.team.id,
      regularUser.id,
      adminUser.id
    );
    const attendAdminRes = await adminOverrideAttendAction(
      startedQuiz.team.id,
      adminUser.id,
      adminUser.id
    );
    const reorderRes = await adminReorderRsvpAction(startedQuiz.team.id, 0, 1);
    const declineRes = await adminOverrideDeclineAction(
      startedQuiz.team.id,
      regularUser.id,
      adminUser.id
    );

    expect(attendRes.success).toBe(true);
    expect(attendAdminRes.success).toBe(true);
    expect(reorderRes.success).toBe(true);
    expect(declineRes.success).toBe(true);
  });
});
