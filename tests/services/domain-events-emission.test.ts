import { describe, it, expect, vi, beforeEach } from "vitest";
import { domainEvents } from "@/lib/events";
import { registerTeam, unregisterTeam } from "@/services/registrationService";
import { updateQuizDetails, cancelQuiz, createQuiz } from "@/services/quizService";
import { setRsvp } from "@/services/rsvpService";
import { markTeamPaid, markTeamUnpaid } from "@/services/paymentService";
import { prisma } from "@/lib/db";

describe("Domain Services Event Emission", () => {
  beforeEach(() => {
    domainEvents.clear();
  });

  it("emits team.registered when registerTeam succeeds", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Reg Test Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );

    const spy = vi.fn();
    domainEvents.subscribe("team.registered", spy);

    await registerTeam(quiz.team!.id, admin.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team.registered",
        quizId: quiz.id,
        occurredAt: expect.any(Date),
      })
    );
  });

  it("emits team.registration_cancelled when unregisterTeam succeeds", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Unreg Test Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );

    await registerTeam(quiz.team!.id, admin.id);

    const spy = vi.fn();
    domainEvents.subscribe("team.registration_cancelled", spy);

    await unregisterTeam(quiz.team!.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team.registration_cancelled",
        quizId: quiz.id,
        occurredAt: expect.any(Date),
      })
    );
  });

  it("emits quiz.details_updated when updateQuizDetails succeeds", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Details Test Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );

    const spy = vi.fn();
    domainEvents.subscribe("quiz.details_updated", spy);

    await updateQuizDetails(quiz.id, { location: "Nieuwe Locatie" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "quiz.details_updated",
        quizId: quiz.id,
        occurredAt: expect.any(Date),
      })
    );
  });

  it("emits quiz.cancelled when cancelQuiz succeeds", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Cancel Test Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );

    const spy = vi.fn();
    domainEvents.subscribe("quiz.cancelled", spy);

    await cancelQuiz(quiz.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "quiz.cancelled",
        quizId: quiz.id,
        occurredAt: expect.any(Date),
      })
    );
  });

  it("emits team.roster_changed when setRsvp changes an attending RSVP", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Rsvp Test Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );
    const member = await prisma.member.create({
      data: { name: `Player-${Date.now()}-${Math.random()}` },
    });

    const spy = vi.fn();
    domainEvents.subscribe("team.roster_changed", spy);

    await setRsvp(quiz.team!.id, member.id, "ATTENDING");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team.roster_changed",
        quizId: quiz.id,
        occurredAt: expect.any(Date),
      })
    );
  });

  it("emits team.payment_changed when markTeamPaid succeeds", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Payment Test Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );

    const spy = vi.fn();
    domainEvents.subscribe("team.payment_changed", spy);

    await markTeamPaid(quiz.team!.id, admin.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team.payment_changed",
        quizId: quiz.id,
        occurredAt: expect.any(Date),
      })
    );
  });

  it("emits team.payment_changed when markTeamUnpaid succeeds", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await createQuiz(
      {
        title: "Unpaid Test Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Gent",
        maxTeamSize: 4,
      },
      admin.id
    );

    await markTeamPaid(quiz.team!.id, admin.id);

    const spy = vi.fn();
    domainEvents.subscribe("team.payment_changed", spy);

    await markTeamUnpaid(quiz.team!.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team.payment_changed",
        quizId: quiz.id,
        occurredAt: expect.any(Date),
      })
    );
  });
});
