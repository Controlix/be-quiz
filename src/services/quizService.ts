import { prisma } from "@/lib/db";
import { Quiz, Team } from "@prisma/client";

export function formatStructuredEntryFee(
  amount?: number | string,
  unit: "TEAM" | "PERSON" = "TEAM"
): string | undefined {
  if (amount === undefined || amount === null) return undefined;
  const cleanAmount = String(amount).replace(/[^0-9.,]/g, "").trim();
  if (!cleanAmount) return undefined;

  const unitLabel = unit === "PERSON" ? "persoon" : "ploeg";
  return `€${cleanAmount} / ${unitLabel}`;
}

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

export interface QuizValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateQuizFields(data: {
  title?: string;
  location?: string;
  organizerEmail?: string | null;
  entryFee?: string | null;
}): QuizValidationResult {
  const errors: Record<string, string> = {};

  if (data.title && data.title.trim().length > 100) {
    errors.title = "Titel mag maximaal 100 tekens bevatten";
  }

  if (data.location && data.location.trim().length > 120) {
    errors.location = "Locatie mag maximaal 120 tekens bevatten";
  }

  if (data.entryFee && data.entryFee.trim().length > 40) {
    errors.entryFee = "Inschrijfgeld mag maximaal 40 tekens bevatten";
  }

  if (data.organizerEmail && data.organizerEmail.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.organizerEmail.trim())) {
      errors.organizerEmail = "Ongeldig e-mailadres voor organisatie";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
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
