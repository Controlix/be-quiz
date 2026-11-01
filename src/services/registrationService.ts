import { prisma } from "@/lib/db";
import { domainEvents } from "@/lib/events";

export async function setTeamRegistered(teamId: string, memberId: string): Promise<void> {
  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      registeredAt: new Date(),
      registeredById: memberId,
    },
    select: { quizId: true },
  });

  domainEvents.emit({
    type: "team.registered",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function adminResetRegistration(teamId: string): Promise<void> {
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

export const registerTeam = setTeamRegistered;
export const unregisterTeam = adminResetRegistration;

