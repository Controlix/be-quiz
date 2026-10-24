import { prisma } from "@/lib/db";
import { Quiz, Team } from "@prisma/client";

export interface CreateQuizInput {
  title: string;
  startsAt: Date;
  timeZone?: string;
  durationMinutes?: number;
  location: string;
  maxTeamSize: number;
  organizerEmail?: string;
  registrationUrl?: string;
  entryFee?: string;
  notes?: string;
  flyerImageUrl?: string;
}

export async function createQuiz(
  data: CreateQuizInput,
  creatorId: string
): Promise<Quiz & { team: Team }> {
  // Fetch default team name from singleton
  const settings = await prisma.teamSetting.findUnique({
    where: { id: "singleton" },
  });
  const defaultTeamName = settings?.defaultTeamName || "De Quizvrienden";

  return prisma.$transaction(async (tx) => {
    const quiz = await tx.quiz.create({
      data: {
        title: data.title,
        startsAt: data.startsAt,
        timeZone: data.timeZone || "Europe/Brussels",
        durationMinutes: data.durationMinutes || 180,
        location: data.location,
        organizerEmail: data.organizerEmail,
        registrationUrl: data.registrationUrl,
        entryFee: data.entryFee,
        notes: data.notes,
        flyerImageUrl: data.flyerImageUrl,
        createdById: creatorId,
        team: {
          create: {
            name: defaultTeamName,
            maxTeamSize: data.maxTeamSize,
          },
        },
      },
      include: {
        team: true,
      },
    });

    return quiz as Quiz & { team: Team };
  });
}

export async function getAllQuizzes() {
  return prisma.quiz.findMany({
    include: {
      team: {
        include: {
          rsvps: {
            include: {
              member: true,
            },
          },
        },
      },
      createdBy: true,
    },
    orderBy: {
      startsAt: "asc",
    },
  });
}

export async function getQuizById(id: string) {
  return prisma.quiz.findUnique({
    where: { id },
    include: {
      team: {
        include: {
          rsvps: {
            include: {
              member: true,
            },
            orderBy: {
              queuedSince: "asc",
            },
          },
          paidBy: true,
          registeredBy: true,
        },
      },
      createdBy: true,
    },
  });
}
