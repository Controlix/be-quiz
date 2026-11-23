import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../src/lib/db";
import * as auth from "../../src/lib/auth";
import { updateQuizDetailsAction } from "../../src/actions/quizActions";
import { QUIZ_LOCKED_MUTATION_ERROR } from "../../src/lib/quizLock";
import { domainEvents, DomainEvent } from "../../src/lib/events";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("updateQuizDetailsAction", () => {
  let regularUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let adminUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let futureQuiz: any;
  let startedQuiz: any;
  let cancelledQuiz: any;
  let archivedQuiz: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    domainEvents.clear();
    const suffix = `${Date.now()}-${Math.random()}`;

    regularUser = await prisma.member.create({
      data: { name: `EditUser-${suffix}`, role: "USER" },
    });
    adminUser = await prisma.member.create({
      data: { name: `EditAdmin-${suffix}`, role: "ADMIN" },
    });

    const baseStart = new Date(Date.now() + 86400000);
    futureQuiz = await prisma.quiz.create({
      data: {
        title: "Originele Titel",
        startsAt: baseStart,
        location: "Zaal A, Gent",
        organizerEmail: "old@quiz.be",
        entryFee: "€20 / ploeg",
        flyerImageUrl: "/uploads/original.jpg",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    });

    startedQuiz = await prisma.quiz.create({
      data: {
        title: "Gestarte Quiz",
        startsAt: new Date(Date.now() - 60000),
        location: "Antwerpen",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
    });

    cancelledQuiz = await prisma.quiz.create({
      data: {
        title: "Geannuleerde Quiz",
        startsAt: baseStart,
        status: "CANCELLED",
        location: "Brugge",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
    });

    archivedQuiz = await prisma.quiz.create({
      data: {
        title: "Gearchiveerde Quiz",
        startsAt: baseStart,
        status: "ARCHIVED",
        location: "Leuven",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
    });
  });

  it("rejects unauthenticated callers without modifying the database", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);
    const res = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Hacked",
      startsAt: new Date(Date.now() + 172800000),
      location: "Brussel",
      organizerEmail: null,
      entryFee: null,
    });
    expect(res).toEqual({ success: false, error: "Niet ingelogd" });
    const fresh = await prisma.quiz.findUnique({ where: { id: futureQuiz.id } });
    expect(fresh?.title).toBe("Originele Titel");
  });

  it("returns an error when quizId does not exist", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const res = await updateQuizDetailsAction("non-existent-quiz-id", {
      title: "Titel",
      startsAt: new Date(Date.now() + 172800000),
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(res).toEqual({ success: false, error: "Quiz niet gevonden" });
  });

  it("blocks regular USER from editing started, CANCELLED, or ARCHIVED quizzes while allowing ADMIN", async () => {
    for (const locked of [startedQuiz, cancelledQuiz, archivedQuiz]) {
      vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
      const userRes = await updateQuizDetailsAction(locked.id, {
        title: "Geblokkeerde Update",
        startsAt: new Date(Date.now() + 172800000),
        location: "Nieuw",
        organizerEmail: null,
        entryFee: null,
      });
      expect(userRes).toEqual({ success: false, error: QUIZ_LOCKED_MUTATION_ERROR });

      vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
      const adminRes = await updateQuizDetailsAction(locked.id, {
        title: `Admin Fix ${locked.id}`,
        startsAt: new Date(Date.now() + 172800000),
        location: "Herstelde Locatie",
        organizerEmail: "admin@quiz.be",
        entryFee: "€5 / persoon",
      });
      expect(adminRes.success).toBe(true);
    }
  });

  it("allows USER on open future quiz, clears optional fields with null, preserves governance fields, and emits quiz.details_updated", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const emitted: Array<Extract<DomainEvent, { type: "quiz.details_updated" }>> = [];
    domainEvents.subscribe("quiz.details_updated", (event) => {
      emitted.push(event);
    });

    const nextStart = new Date(2027, 2, 15, 20, 30);
    const res = await updateQuizDetailsAction(futureQuiz.id, {
      title: "  Aangepaste Titel  ",
      startsAt: nextStart.toISOString(),
      location: "  Zaal B, Gent  ",
      organizerEmail: "",
      entryFee: null,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.quiz.title).toBe("Aangepaste Titel");
      expect(new Date(res.quiz.startsAt).getTime()).toBe(nextStart.getTime());
      expect(res.quiz.location).toBe("Zaal B, Gent");
      expect(res.quiz.organizerEmail).toBeNull();
      expect(res.quiz.entryFee).toBeNull();
    }

    const updated = await prisma.quiz.findUnique({
      where: { id: futureQuiz.id },
      include: { team: true },
    });
    expect(updated?.title).toBe("Aangepaste Titel");
    expect(updated?.startsAt.getTime()).toBe(nextStart.getTime());
    expect(updated?.location).toBe("Zaal B, Gent");
    expect(updated?.organizerEmail).toBeNull();
    expect(updated?.entryFee).toBeNull();
    expect(updated?.flyerImageUrl).toBe("/uploads/original.jpg");
    expect(updated?.status).toBe("OPEN");
    expect(updated?.team?.maxTeamSize).toBe(4);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].quizId).toBe(futureQuiz.id);
  });

  it("rejects empty title/location, invalid/empty/null startsAt, invalid email, and overlong fields", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const validStart = new Date(Date.now() + 172800000);

    const emptyTitle = await updateQuizDetailsAction(futureQuiz.id, {
      title: "   ",
      startsAt: validStart,
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(emptyTitle.success).toBe(false);

    const emptyLocation = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: validStart,
      location: "   ",
      organizerEmail: null,
      entryFee: null,
    });
    expect(emptyLocation.success).toBe(false);

    const nullStart = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: null as unknown as string,
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(nullStart.success).toBe(false);

    const emptyStart = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: "",
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(emptyStart.success).toBe(false);

    const invalidStart = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: "not-a-date",
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(invalidStart.success).toBe(false);

    const badEmail = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: validStart,
      location: "Gent",
      organizerEmail: "geen-email",
      entryFee: null,
    });
    expect(badEmail).toEqual({
      success: false,
      error: "Ongeldig e-mailadres voor organisatie",
    });

    const longTitle = await updateQuizDetailsAction(futureQuiz.id, {
      title: "A".repeat(101),
      startsAt: validStart,
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(longTitle).toEqual({
      success: false,
      error: "Titel mag maximaal 100 tekens bevatten",
    });
  });
});
