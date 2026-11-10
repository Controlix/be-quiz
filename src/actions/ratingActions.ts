"use server";

import { getSessionMember } from "@/lib/auth";
import { submitQuizRating, QuizRatingSummary } from "@/services/ratingService";
import { revalidatePath } from "next/cache";

export async function rateQuizAction(
  quizId: string,
  score: number
): Promise<{ success: true; summary: QuizRatingSummary } | { success: false; error: string }> {
  try {
    const member = await getSessionMember();
    if (!member) {
      return { success: false, error: "Niet ingelogd" };
    }

    const summary = await submitQuizRating({
      quizId,
      memberId: member.id,
      score,
    });

    revalidatePath(`/quizzes/${quizId}`);
    revalidatePath("/quizzes");

    return { success: true, summary };
  } catch (err: any) {
    const errorMap: Record<string, string> = {
      QUIZ_NOT_FOUND: "Quiz niet gevonden.",
      QUIZ_CANCELLED: "Geannuleerde quizzen kunnen niet beoordeeld worden.",
      QUIZ_NOT_CONCLUDED: "Deze quiz is nog niet afgelopen.",
      NOT_ELIGIBLE: "Alleen spelers uit de vaste opstelling kunnen deze quiz beoordelen.",
    };

    return {
      success: false,
      error:
        errorMap[err.message] || err.message || "Er is een fout opgetreden bij het beoordelen.",
    };
  }
}
