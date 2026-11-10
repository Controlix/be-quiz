"use server";

import { prisma } from "@/lib/db";
import { setRsvp } from "@/services/rsvpService";
import { getQuizRatingSummary } from "@/services/ratingService";
import { revalidatePath } from "next/cache";

export async function joinQuizRsvpAction(teamId: string, memberId: string, quizId?: string) {
  try {
    await setRsvp(teamId, memberId, "ATTENDING");
    if (!quizId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { quizId: true },
      });
      quizId = team?.quizId;
    }
    if (quizId) {
      revalidatePath(`/quizzes/${quizId}`);
    }
    revalidatePath("/quizzes");

    const ratingSummary = quizId ? await getQuizRatingSummary(quizId, memberId) : undefined;
    return { success: true, ratingSummary };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function declineQuizRsvpAction(teamId: string, memberId: string, quizId?: string) {
  try {
    await setRsvp(teamId, memberId, "DECLINED");
    if (!quizId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { quizId: true },
      });
      quizId = team?.quizId;
    }
    if (quizId) {
      revalidatePath(`/quizzes/${quizId}`);
    }
    revalidatePath("/quizzes");

    const ratingSummary = quizId ? await getQuizRatingSummary(quizId, memberId) : undefined;
    return { success: true, ratingSummary };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
