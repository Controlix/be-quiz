"use server";

import { createQuiz, CreateQuizInput } from "@/services/quizService";
import { revalidatePath } from "next/cache";

export async function createQuizAction(data: CreateQuizInput, creatorId: string) {
  try {
    const quiz = await createQuiz(data, creatorId);
    revalidatePath("/quizzes");
    return { success: true, quizId: quiz.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
