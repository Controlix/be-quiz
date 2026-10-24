"use server";

import { createQuiz, CreateQuizInput, validateQuizFields } from "@/services/quizService";
import { revalidatePath } from "next/cache";

export async function createQuizAction(data: CreateQuizInput, creatorId: string) {
  try {
    const validation = validateQuizFields({
      title: data.title,
      location: data.location,
      organizerEmail: data.organizerEmail,
      entryFee: data.entryFee,
    });
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      return { success: false, error: firstError };
    }

    const quiz = await createQuiz(data, creatorId);
    revalidatePath("/quizzes");
    return { success: true, quizId: quiz.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
