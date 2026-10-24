"use server";

import { setRsvp } from "@/services/rsvpService";
import { revalidatePath } from "next/cache";

export async function joinQuizRsvpAction(teamId: string, memberId: string) {
  try {
    await setRsvp(teamId, memberId, "ATTENDING");
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function declineQuizRsvpAction(teamId: string, memberId: string) {
  try {
    await setRsvp(teamId, memberId, "DECLINED");
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
