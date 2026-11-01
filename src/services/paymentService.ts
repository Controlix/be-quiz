import { prisma } from "@/lib/db";
import { domainEvents } from "@/lib/events";

export async function markTeamPaid(teamId: string, memberId: string): Promise<void> {
  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      paidAt: new Date(),
      paidById: memberId,
    },
    select: { quizId: true },
  });

  domainEvents.emit({
    type: "team.payment_changed",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function markTeamUnpaid(teamId: string): Promise<void> {
  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      paidAt: null,
      paidById: null,
    },
    select: { quizId: true },
  });

  domainEvents.emit({
    type: "team.payment_changed",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function toggleFeePayment(teamId: string, memberId: string): Promise<boolean> {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { paidAt: true },
  });

  const shouldMarkPaid = team.paidAt === null;

  if (shouldMarkPaid) {
    await markTeamPaid(teamId, memberId);
  } else {
    await markTeamUnpaid(teamId);
  }

  return shouldMarkPaid;
}

