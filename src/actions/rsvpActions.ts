"use server";

import { prisma } from "@/lib/db";
import { getSessionMember } from "@/lib/auth";
import { setRsvp } from "@/services/rsvpService";
import { getQuizRatingSummary } from "@/services/ratingService";
import { revalidatePath } from "next/cache";

export async function joinQuizRsvpAction(teamId: string, _memberId?: string, quizId?: string) {
  try {
    const sessionMember = await getSessionMember();
    if (!sessionMember) {
      return { success: false, error: "Niet ingelogd" };
    }

    await setRsvp(teamId, sessionMember.id, "ATTENDING");
    if (!quizId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { quizId: true },
      });
      quizId = team?.quizId;
    }

    try {
      if (quizId) {
        revalidatePath(`/quizzes/${quizId}`);
      }
      revalidatePath("/quizzes");
    } catch {}

    const ratingSummary = quizId ? await getQuizRatingSummary(quizId, sessionMember.id) : undefined;
    return { success: true, ratingSummary };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function declineQuizRsvpAction(teamId: string, _memberId?: string, quizId?: string) {
  try {
    const sessionMember = await getSessionMember();
    if (!sessionMember) {
      return { success: false, error: "Niet ingelogd" };
    }

    await setRsvp(teamId, sessionMember.id, "DECLINED");
    if (!quizId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { quizId: true },
      });
      quizId = team?.quizId;
    }

    try {
      if (quizId) {
        revalidatePath(`/quizzes/${quizId}`);
      }
      revalidatePath("/quizzes");
    } catch {}

    const ratingSummary = quizId ? await getQuizRatingSummary(quizId, sessionMember.id) : undefined;
    return { success: true, ratingSummary };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
