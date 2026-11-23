"use server";

import { prisma } from "@/lib/db";
import { getSessionMember } from "@/lib/auth";
import { registerTeam } from "@/services/registrationService";
import { toggleFeePayment } from "@/services/paymentService";
import { revalidatePath } from "next/cache";

export async function setRegisteredAction(teamId: string, _memberId?: string) {
  try {
    const sessionMember = await getSessionMember();
    if (!sessionMember) {
      return { success: false, error: "Niet ingelogd" };
    }

    await registerTeam(teamId, sessionMember.id, sessionMember.role);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { quizId: true },
    });

    try {
      if (team?.quizId) {
        revalidatePath(`/quizzes/${team.quizId}`);
      }
      revalidatePath("/quizzes");
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleFeePaidAction(teamId: string, _memberId?: string) {
  try {
    const sessionMember = await getSessionMember();
    if (!sessionMember) {
      return { success: false, error: "Niet ingelogd" };
    }

    const isPaid = await toggleFeePayment(teamId, sessionMember.id, sessionMember.role);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { quizId: true },
    });

    try {
      if (team?.quizId) {
        revalidatePath(`/quizzes/${team.quizId}`);
      }
      revalidatePath("/quizzes");
    } catch {}

    return { success: true, isPaid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
