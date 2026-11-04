import { domainEvents, DomainEvent } from "@/lib/events";
import { prisma } from "@/lib/db";
import { mappingRepository } from "./mappingRepository";
import { GoogleCalendarClient, getGoogleCalendarClient } from "./googleCalendarClient";
import { formatGoogleCalendarPayload } from "./formatter";

export interface SharedCalendarSubscriberOptions {
  client?: GoogleCalendarClient | null;
  calendarId?: string;
  appUrl?: string;
}

const globalForCalendar = globalThis as unknown as {
  __calendarSubscriberRegistered__?: boolean;
};

export function registerSharedCalendarSubscriber(
  options?: SharedCalendarSubscriberOptions
): () => void {
  if (globalForCalendar.__calendarSubscriberRegistered__) {
    return () => {};
  }

  const client = options?.client ?? getGoogleCalendarClient();
  const calendarId = options?.calendarId ?? process.env.GOOGLE_CALENDAR_ID;

  if (!client || !calendarId) {
    return () => {};
  }

  globalForCalendar.__calendarSubscriberRegistered__ = true;

  const activeClient: GoogleCalendarClient = client;
  const activeCalendarId: string = calendarId;

  async function handleEvent(event: DomainEvent): Promise<void> {
    try {
      if (event.type === "team.registered") {
        const quiz = await prisma.quiz.findUnique({
          where: { id: event.quizId },
          include: {
            team: {
              include: {
                rsvps: {
                  include: { member: true },
                  orderBy: { queuedSince: "asc" },
                },
                paidBy: true,
              },
            },
          },
        });

        if (!quiz || !quiz.team || !quiz.team.registeredAt) {
          return;
        }

        const attendingRsvps = quiz.team.rsvps.filter((r) => r.status === "ATTENDING");
        const lineup = attendingRsvps.slice(0, quiz.team.maxTeamSize).map((r) => r.member.name);

        const payment = {
          fee: quiz.entryFee,
          isPaid: Boolean(quiz.team.paidAt),
          payerName: quiz.team.paidBy?.name || null,
        };

        const payload = formatGoogleCalendarPayload({
          quiz: {
            id: quiz.id,
            title: quiz.title,
            startsAt: quiz.startsAt,
            durationMinutes: quiz.durationMinutes,
            location: quiz.location,
            timeZone: quiz.timeZone,
          },
          lineup,
          payment,
          appUrl: options?.appUrl || process.env.APP_URL,
        });

        const existingMapping = await mappingRepository.findByQuizId(quiz.id);
        if (existingMapping) {
          const updateResult = await activeClient.updateEvent(
            existingMapping.calendarId,
            existingMapping.externalEventId,
            payload
          );
          if (updateResult.notFound) {
            // External event was deleted in Google Calendar: recreate and update mapping
            const created = await activeClient.insertEvent(activeCalendarId, payload);
            await mappingRepository.upsertMapping(quiz.id, created.id, activeCalendarId);
          } else {
            await mappingRepository.upsertMapping(
              quiz.id,
              existingMapping.externalEventId,
              existingMapping.calendarId
            );
          }
        } else {
          const created = await activeClient.insertEvent(activeCalendarId, payload);
          await mappingRepository.upsertMapping(quiz.id, created.id, activeCalendarId);
        }
      } else if (event.type === "team.registration_cancelled" || event.type === "quiz.cancelled") {
        const existingMapping = await mappingRepository.findByQuizId(event.quizId);
        if (existingMapping) {
          await activeClient.deleteEvent(
            existingMapping.calendarId,
            existingMapping.externalEventId
          );
          await mappingRepository.deleteByQuizId(event.quizId);
        }
      } else if (
        event.type === "quiz.details_updated" ||
        event.type === "team.roster_changed" ||
        event.type === "team.payment_changed"
      ) {
        const existingMapping = await mappingRepository.findByQuizId(event.quizId);
        if (!existingMapping) {
          return;
        }

        const quiz = await prisma.quiz.findUnique({
          where: { id: event.quizId },
          include: {
            team: {
              include: {
                rsvps: {
                  include: { member: true },
                  orderBy: { queuedSince: "asc" },
                },
                paidBy: true,
              },
            },
          },
        });

        if (!quiz || quiz.status === "CANCELLED" || !quiz.team || !quiz.team.registeredAt) {
          await activeClient.deleteEvent(
            existingMapping.calendarId,
            existingMapping.externalEventId
          );
          await mappingRepository.deleteByQuizId(event.quizId);
          return;
        }

        const attendingRsvps = quiz.team.rsvps.filter((r) => r.status === "ATTENDING");
        const lineup = attendingRsvps.slice(0, quiz.team.maxTeamSize).map((r) => r.member.name);

        const payment = {
          fee: quiz.entryFee,
          isPaid: Boolean(quiz.team.paidAt),
          payerName: quiz.team.paidBy?.name || null,
        };

        const payload = formatGoogleCalendarPayload({
          quiz: {
            id: quiz.id,
            title: quiz.title,
            startsAt: quiz.startsAt,
            durationMinutes: quiz.durationMinutes,
            location: quiz.location,
            timeZone: quiz.timeZone,
          },
          lineup,
          payment,
          appUrl: options?.appUrl || process.env.APP_URL,
        });

        const updateResult = await activeClient.updateEvent(
          existingMapping.calendarId,
          existingMapping.externalEventId,
          payload
        );
        if (updateResult.notFound) {
          // Event was deleted in Google Calendar: clean up stale mapping
          await mappingRepository.deleteByQuizId(event.quizId);
        } else {
          await mappingRepository.upsertMapping(
            quiz.id,
            existingMapping.externalEventId,
            existingMapping.calendarId
          );
        }
      }
    } catch (error) {
      console.error("[GoogleCalendarSync] Error syncing quiz:", {
        quizId: event.quizId,
        eventType: event.type,
        error,
      });
    }
  }

  const unsubs: Array<() => void> = [
    domainEvents.subscribe("team.registered", handleEvent),
    domainEvents.subscribe("team.registration_cancelled", handleEvent),
    domainEvents.subscribe("quiz.cancelled", handleEvent),
    domainEvents.subscribe("quiz.details_updated", handleEvent),
    domainEvents.subscribe("team.roster_changed", handleEvent),
    domainEvents.subscribe("team.payment_changed", handleEvent),
  ];

  return () => {
    globalForCalendar.__calendarSubscriberRegistered__ = false;
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
