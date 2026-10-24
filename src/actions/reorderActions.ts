"use server";

import { reorderRsvps } from "@/services/rsvpService";
import { getSessionMember } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function adminReorderRsvpAction(
  teamId: string,
  sourceIndex: number,
  destinationIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    await reorderRsvps(teamId, sourceIndex, destinationIndex);
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
