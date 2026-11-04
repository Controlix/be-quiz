import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { domainEvents } from "@/lib/events";
import { registerSharedCalendarSubscriber } from "@/features/calendar/shared/subscriber";
import { mappingRepository } from "@/features/calendar/shared/mappingRepository";
import { prisma } from "@/lib/db";
import { GoogleCalendarClient } from "@/features/calendar/shared/googleCalendarClient";

describe("Shared Calendar Subscriber", () => {
  let unsubscribe: () => void;
  let mockClient: GoogleCalendarClient;

  beforeEach(async () => {
    domainEvents.clear();

    mockClient = {
      insertEvent: vi.fn().mockResolvedValue({ id: "gcal-event-created" }),
      updateEvent: vi.fn().mockResolvedValue({ updated: true }),
      deleteEvent: vi.fn().mockResolvedValue(undefined),
    };

    unsubscribe = registerSharedCalendarSubscriber({
      client: mockClient,
      calendarId: "test-cal-id@group.calendar.google.com",
      appUrl: "https://quiz.example.com",
    });
  });

  afterEach(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  it("inserts calendar event on team.registered when no mapping exists", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const player = await prisma.member.create({
      data: { name: `Player-${Date.now()}-${Math.random()}` },
    });

    const quiz = await prisma.quiz.create({
      data: {
        title: "Kwies van de Eeuw",
        startsAt: new Date("2026-11-25T19:00:00Z"),
        location: "Kerkstraat 1, Gent",
        createdById: admin.id,
        team: {
          create: {
            name: "Ben in Black",
            registeredAt: new Date(),
            registeredById: admin.id,
            rsvps: {
              create: {
                memberId: player.id,
                status: "ATTENDING",
                queuedSince: new Date(),
              },
            },
          },
        },
      },
      include: { team: true },
    });

    domainEvents.emit({
      type: "team.registered",
      quizId: quiz.id,
      occurredAt: new Date(),
    });

    await vi.waitFor(
      async () => {
        expect(mockClient.insertEvent).toHaveBeenCalledTimes(1);
        const mapping = await mappingRepository.findByQuizId(quiz.id);
        expect(mapping?.externalEventId).toBe("gcal-event-created");
      },
      { timeout: 1500 }
    );

    expect(mockClient.insertEvent).toHaveBeenCalledWith(
      "test-cal-id@group.calendar.google.com",
      expect.objectContaining({
        summary: "Kwies van de Eeuw",
        location: "Kerkstraat 1, Gent",
      })
    );

    const mapping = await mappingRepository.findByQuizId(quiz.id);
    expect(mapping?.calendarId).toBe("test-cal-id@group.calendar.google.com");
  });

  it("updates calendar event on team.registered if mapping already exists (idempotent)", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });

    const quiz = await prisma.quiz.create({
      data: {
        title: "Re-registration Quiz",
        startsAt: new Date("2026-11-25T19:00:00Z"),
        location: "Gent",
        createdById: admin.id,
        team: {
          create: {
            name: "Ben in Black",
            registeredAt: new Date(),
            registeredById: admin.id,
          },
        },
      },
    });

    await mappingRepository.upsertMapping(
      quiz.id,
      "existing-gcal-id",
      "test-cal-id@group.calendar.google.com"
    );

    domainEvents.emit({
      type: "team.registered",
      quizId: quiz.id,
      occurredAt: new Date(),
    });

    await vi.waitFor(
      () => {
        expect(mockClient.updateEvent).toHaveBeenCalledTimes(1);
      },
      { timeout: 1500 }
    );

    expect(mockClient.updateEvent).toHaveBeenCalledWith(
      "test-cal-id@group.calendar.google.com",
      "existing-gcal-id",
      expect.objectContaining({ summary: "Re-registration Quiz" })
    );
    expect(mockClient.insertEvent).not.toHaveBeenCalled();
  });

  it("deletes calendar event on team.registration_cancelled when mapping exists", async () => {
    await mappingRepository.upsertMapping(
      "quiz-cancel-reg",
      "gcal-123",
      "test-cal-id@group.calendar.google.com"
    );

    domainEvents.emit({
      type: "team.registration_cancelled",
      quizId: "quiz-cancel-reg",
      occurredAt: new Date(),
    });

    await vi.waitFor(
      () => {
        expect(mockClient.deleteEvent).toHaveBeenCalledWith(
          "test-cal-id@group.calendar.google.com",
          "gcal-123"
        );
      },
      { timeout: 1500 }
    );

    const mapping = await mappingRepository.findByQuizId("quiz-cancel-reg");
    expect(mapping).toBeNull();
  });

  it("deletes calendar event on quiz.cancelled when mapping exists", async () => {
    await mappingRepository.upsertMapping(
      "quiz-full-cancel",
      "gcal-999",
      "test-cal-id@group.calendar.google.com"
    );

    domainEvents.emit({
      type: "quiz.cancelled",
      quizId: "quiz-full-cancel",
      occurredAt: new Date(),
    });

    await vi.waitFor(
      () => {
        expect(mockClient.deleteEvent).toHaveBeenCalledWith(
          "test-cal-id@group.calendar.google.com",
          "gcal-999"
        );
      },
      { timeout: 1500 }
    );

    const mapping = await mappingRepository.findByQuizId("quiz-full-cancel");
    expect(mapping).toBeNull();
  });

  it("updates calendar event on team.roster_changed when mapping exists", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Roster Update Quiz",
        startsAt: new Date("2026-11-25T19:00:00Z"),
        location: "Gent",
        createdById: admin.id,
        team: {
          create: {
            name: "Ben in Black",
            registeredAt: new Date(),
          },
        },
      },
    });

    await mappingRepository.upsertMapping(
      quiz.id,
      "gcal-roster-1",
      "test-cal-id@group.calendar.google.com"
    );

    domainEvents.emit({
      type: "team.roster_changed",
      quizId: quiz.id,
      occurredAt: new Date(),
    });

    await vi.waitFor(
      () => {
        expect(mockClient.updateEvent).toHaveBeenCalledTimes(1);
      },
      { timeout: 1500 }
    );

    expect(mockClient.updateEvent).toHaveBeenCalledWith(
      "test-cal-id@group.calendar.google.com",
      "gcal-roster-1",
      expect.objectContaining({ summary: "Roster Update Quiz" })
    );
  });

  it("recreates event on team.registered if updateEvent returns notFound: true", async () => {
    mockClient.updateEvent = vi.fn().mockResolvedValue({ updated: false, notFound: true });
    mockClient.insertEvent = vi.fn().mockResolvedValue({ id: "gcal-event-recreated" });

    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Self-Healing Quiz",
        startsAt: new Date("2026-11-25T19:00:00Z"),
        location: "Gent",
        createdById: admin.id,
        team: {
          create: {
            name: "Ben in Black",
            registeredAt: new Date(),
            registeredById: admin.id,
          },
        },
      },
    });

    await mappingRepository.upsertMapping(
      quiz.id,
      "deleted-in-gcal-id",
      "test-cal-id@group.calendar.google.com"
    );

    domainEvents.emit({
      type: "team.registered",
      quizId: quiz.id,
      occurredAt: new Date(),
    });

    await vi.waitFor(
      async () => {
        expect(mockClient.updateEvent).toHaveBeenCalledTimes(1);
        expect(mockClient.insertEvent).toHaveBeenCalledTimes(1);
        const mapping = await mappingRepository.findByQuizId(quiz.id);
        expect(mapping?.externalEventId).toBe("gcal-event-recreated");
      },
      { timeout: 1500 }
    );
  });

  it("deletes stale mapping on team.roster_changed if updateEvent returns notFound: true", async () => {
    mockClient.updateEvent = vi.fn().mockResolvedValue({ updated: false, notFound: true });

    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Stale Mapping Quiz",
        startsAt: new Date("2026-11-25T19:00:00Z"),
        location: "Gent",
        createdById: admin.id,
        team: {
          create: {
            name: "Ben in Black",
            registeredAt: new Date(),
          },
        },
      },
    });

    await mappingRepository.upsertMapping(
      quiz.id,
      "stale-gcal-id",
      "test-cal-id@group.calendar.google.com"
    );

    domainEvents.emit({
      type: "team.roster_changed",
      quizId: quiz.id,
      occurredAt: new Date(),
    });

    await vi.waitFor(
      async () => {
        expect(mockClient.updateEvent).toHaveBeenCalledTimes(1);
        const mapping = await mappingRepository.findByQuizId(quiz.id);
        expect(mapping).toBeNull();
      },
      { timeout: 1500 }
    );
  });

  it("does nothing on team.roster_changed when no mapping exists (unregistered quiz)", async () => {
    domainEvents.emit({
      type: "team.roster_changed",
      quizId: "quiz-unmapped",
      occurredAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 60));

    expect(mockClient.updateEvent).not.toHaveBeenCalled();
    expect(mockClient.insertEvent).not.toHaveBeenCalled();
    expect(mockClient.deleteEvent).not.toHaveBeenCalled();
  });

  it("catches errors and logs to console without throwing when Google API fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClient.insertEvent = vi.fn().mockRejectedValue(new Error("Google 503 Service Unavailable"));

    const admin = await prisma.member.create({
      data: { name: `Admin-${Date.now()}-${Math.random()}`, role: "ADMIN" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Failing Quiz",
        startsAt: new Date("2026-11-25T19:00:00Z"),
        location: "Gent",
        createdById: admin.id,
        team: {
          create: {
            name: "Ben in Black",
            registeredAt: new Date(),
          },
        },
      },
    });

    expect(() => {
      domainEvents.emit({
        type: "team.registered",
        quizId: quiz.id,
        occurredAt: new Date(),
      });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 60));

    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[GoogleCalendarSync] Error syncing quiz:"),
      expect.objectContaining({ quizId: quiz.id })
    );

    errorSpy.mockRestore();
  });
});
