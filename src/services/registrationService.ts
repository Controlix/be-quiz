import { prisma } from "@/lib/db";

export async function setTeamRegistered(teamId: string, memberId: string): Promise<void> {
  await prisma.team.update({
    where: { id: teamId },
    data: {
      registeredAt: new Date(),
      registeredById: memberId,
    },
  });
}

export async function adminResetRegistration(teamId: string): Promise<void> {
  await prisma.team.update({
    where: { id: teamId },
    data: {
      registeredAt: null,
      registeredById: null,
    },
  });
}
