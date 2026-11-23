"use server";

import {
  createQuiz,
  CreateQuizInput,
  getQuizById,
  updateQuizDetails,
  validateQuizFields,
} from "@/services/quizService";
import { getSessionMember } from "@/lib/auth";
import { isQuizLockedForUser, QUIZ_LOCKED_MUTATION_ERROR } from "@/lib/quizLock";
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
    try {
      revalidatePath("/quizzes");
    } catch {
      // Ignore outside Next.js request context (e.g. Vitest node runs)
    }
    return { success: true, quizId: quiz.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface UpdateQuizMetadataInput {
  title: string;
  startsAt: Date | string;
  location: string;
  organizerEmail: string | null;
  entryFee: string | null;
}

export type UpdateQuizDetailsActionResult =
  | {
      success: true;
      quiz: {
        id: string;
        title: string;
        startsAt: Date;
        location: string;
        organizerEmail: string | null;
        entryFee: string | null;
      };
    }
  | {
      success: false;
      error: string;
    };

export async function updateQuizDetailsAction(
  quizId: string,
  rawInput: UpdateQuizMetadataInput
): Promise<UpdateQuizDetailsActionResult> {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember) {
      return { success: false, error: "Niet ingelogd" };
    }

    const existingQuiz = await getQuizById(quizId);
    if (!existingQuiz) {
      return { success: false, error: "Quiz niet gevonden" };
    }

    if (isQuizLockedForUser(existingQuiz, currentMember.role)) {
      return { success: false, error: QUIZ_LOCKED_MUTATION_ERROR };
    }

    const title = (rawInput.title ?? "").trim();
    const location = (rawInput.location ?? "").trim();
    if (!title || !location) {
      return { success: false, error: "Titel en locatie zijn verplicht." };
    }

    if (!rawInput.startsAt) {
      return { success: false, error: "Ongeldige startdatum of -tijd." };
    }
    const startsAt = new Date(rawInput.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return { success: false, error: "Ongeldige startdatum of -tijd." };
    }

    const organizerEmail = rawInput.organizerEmail?.trim() ? rawInput.organizerEmail.trim() : null;
    const entryFee = rawInput.entryFee?.trim() ? rawInput.entryFee.trim() : null;

    const validation = validateQuizFields({
      title,
      location,
      organizerEmail,
      entryFee,
    });
    if (!validation.isValid) {
      return { success: false, error: Object.values(validation.errors)[0] };
    }

    const updated = await updateQuizDetails(quizId, {
      title,
      startsAt,
      location,
      organizerEmail,
      entryFee,
    });

    try {
      revalidatePath("/quizzes");
      revalidatePath(`/quizzes/${quizId}`);
    } catch {
      // Ignore outside Next.js request context (e.g. Vitest node runs)
    }

    return {
      success: true,
      quiz: {
        id: updated.id,
        title: updated.title,
        startsAt: updated.startsAt,
        location: updated.location,
        organizerEmail: updated.organizerEmail,
        entryFee: updated.entryFee,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Fout bij bijwerken van quizgegevens.",
    };
  }
}
