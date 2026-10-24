import { prisma } from "@/lib/db";

export async function toggleFeePayment(teamId: string, memberId: string): Promise<boolean> {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { paidAt: true },
  });

  const shouldMarkPaid = team.paidAt === null;

  await prisma.team.update({
    where: { id: teamId },
    data: {
      paidAt: shouldMarkPaid ? new Date() : null,
      paidById: shouldMarkPaid ? memberId : null,
    },
  });

  return shouldMarkPaid;
}
