"use server";

import { reorderRsvps } from "@/services/rsvpService";
import { revalidatePath } from "next/cache";

export async function adminReorderRsvpAction(
  teamId: string,
  sourceIndex: number,
  destinationIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await reorderRsvps(teamId, sourceIndex, destinationIndex);
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
