import { prisma } from "@/lib/db";

export interface CalendarEventMappingRecord {
  id: string;
  quizId: string;
  externalEventId: string;
  calendarId: string;
}

export interface CalendarEventMappingRepository {
  findByQuizId(quizId: string): Promise<CalendarEventMappingRecord | null>;
  upsertMapping(quizId: string, externalEventId: string, calendarId: string): Promise<void>;
  deleteByQuizId(quizId: string): Promise<void>;
}

export const mappingRepository: CalendarEventMappingRepository = {
  async findByQuizId(quizId: string): Promise<CalendarEventMappingRecord | null> {
    return prisma.calendarEventMapping.findUnique({
      where: { quizId },
      select: {
        id: true,
        quizId: true,
        externalEventId: true,
        calendarId: true,
      },
    });
  },

  async upsertMapping(quizId: string, externalEventId: string, calendarId: string): Promise<void> {
    await prisma.calendarEventMapping.upsert({
      where: { quizId },
      create: {
        quizId,
        externalEventId,
        calendarId,
      },
      update: {
        externalEventId,
        calendarId,
      },
    });
  },

  async deleteByQuizId(quizId: string): Promise<void> {
    await prisma.calendarEventMapping.deleteMany({
      where: { quizId },
    });
  },
};
