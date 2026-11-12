import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../src/lib/db";
import { addGuestAction, removeGuestAction } from "../../src/actions/guestActions";
import * as auth from "../../src/lib/auth";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("guestActions Server Actions", () => {
  let memberAlice: { id: string; name: string; role: "USER" | "ADMIN" };
  let memberBob: { id: string; name: string; role: "USER" | "ADMIN" };
  let adminCharlie: { id: string; name: string; role: "USER" | "ADMIN" };
  let futureQuiz: { id: string };
  let futureTeam: { id: string };
  let pastQuiz: { id: string };
  let pastTeam: { id: string };

  beforeEach(async () => {
    vi.restoreAllMocks();

    memberAlice = await prisma.member.create({
      data: { name: `Alice-${Date.now()}`, role: "USER" },
    });
    memberBob = await prisma.member.create({
      data: { name: `Bob-${Date.now()}`, role: "USER" },
    });
    adminCharlie = await prisma.member.create({
      data: { name: `Charlie-${Date.now()}`, role: "ADMIN" },
    });

    futureQuiz = await prisma.quiz.create({
      data: {
        title: "Future Action Quiz",
        startsAt: new Date(Date.now() + 86400000), // tomorrow
        location: "Future Venue",
        createdById: adminCharlie.id,
      },
    });
    futureTeam = await prisma.team.create({
      data: {
        quizId: futureQuiz.id,
        name: "Future Squad",
        maxTeamSize: 4,
      },
    });

    pastQuiz = await prisma.quiz.create({
      data: {
        title: "Past Action Quiz",
        startsAt: new Date(Date.now() - 3600000), // 1 hour ago
        location: "Past Venue",
        createdById: adminCharlie.id,
      },
    });
    pastTeam = await prisma.team.create({
      data: {
        quizId: pastQuiz.id,
        name: "Past Squad",
        maxTeamSize: 4,
      },
    });
  });

  it("returns error when unauthenticated", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);

    const result = await addGuestAction(futureTeam.id, "Sarah");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/niet ingelogd/i);
    }
  });

  it("allows an authenticated user to add a guest", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(memberAlice as any);

    const result = await addGuestAction(futureTeam.id, "Sarah");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rsvp.guestName).toBe("Sarah");
      expect(result.rsvp.invitedById).toBe(memberAlice.id);
      expect(result.rsvp.invitedByName).toBe(memberAlice.name);
    }
  });

  it("enforces lockdown when quiz has started for regular users, but allows admin override", async () => {
    // Non-admin Alice attempts to add guest to past quiz
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(memberAlice as any);
    const lockedResult = await addGuestAction(pastTeam.id, "Sarah");
    expect(lockedResult.success).toBe(false);
    if (!lockedResult.success) {
      expect(lockedResult.error).toMatch(/vergrendeld/i);
    }

    // Admin Charlie attempts to add guest to past quiz
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminCharlie as any);
    const adminResult = await addGuestAction(pastTeam.id, "Sarah");
    expect(adminResult.success).toBe(true);

    if (adminResult.success) {
      // Non-admin Alice attempts to remove guest from past quiz -> rejected by lockdown
      vi.spyOn(auth, "getSessionMember").mockResolvedValue(memberAlice as any);
      const lockedRemove = await removeGuestAction(adminResult.rsvp.id, futureTeam.id);
      expect(lockedRemove.success).toBe(false);
      if (!lockedRemove.success) {
        expect(lockedRemove.error).toMatch(/vergrendeld/i);
      }

      // Admin Charlie attempts to remove guest from past quiz -> succeeds
      vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminCharlie as any);
      const adminRemove = await removeGuestAction(adminResult.rsvp.id, pastTeam.id);
      expect(adminRemove.success).toBe(true);
    }
  });

  it("rejects unauthorized removal by non-inviter non-admin", async () => {
    // Alice adds guest to future quiz
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(memberAlice as any);
    const addResult = await addGuestAction(futureTeam.id, "Sarah");
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;

    // Bob attempts to remove Alice's guest
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(memberBob as any);
    const removeResult = await removeGuestAction(addResult.rsvp.id, futureTeam.id);
    expect(removeResult.success).toBe(false);
    if (!removeResult.success) {
      expect(removeResult.error).toMatch(/geen toegang/i);
    }

    // Alice removes her guest
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(memberAlice as any);
    const aliceRemove = await removeGuestAction(addResult.rsvp.id, futureTeam.id);
    expect(aliceRemove.success).toBe(true);
  });
});
