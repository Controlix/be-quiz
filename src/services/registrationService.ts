import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { domainEvents } from "@/lib/events";
import { isQuizLockedForUser, QUIZ_LOCKED_MUTATION_ERROR } from "@/lib/quizLock";

export async function registerTeam(
  teamId: string,
  memberId: string,
  actorRole: Role = "USER"
): Promise<void> {
  const team = await prisma.$transaction(async (tx) => {
    const existingTeam = await tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: {
        quizId: true,
        quiz: { select: { startsAt: true, status: true } },
      },
    });

    if (isQuizLockedForUser(existingTeam.quiz, actorRole)) {
      throw new Error(QUIZ_LOCKED_MUTATION_ERROR);
    }

    return tx.team.update({
      where: { id: teamId },
      data: {
        registeredAt: new Date(),
        registeredById: memberId,
      },
      select: { quizId: true },
    });
  });

  domainEvents.emit({
    type: "team.registered",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function unregisterTeam(teamId: string): Promise<void> {
  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      registeredAt: null,
      registeredById: null,
    },
    select: { quizId: true },
  });

  domainEvents.emit({
    type: "team.registration_cancelled",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}
