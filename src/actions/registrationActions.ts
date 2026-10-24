"use server";

import { setTeamRegistered, adminResetRegistration } from "@/services/registrationService";
import { toggleFeePayment } from "@/services/paymentService";
import { revalidatePath } from "next/cache";

export async function setRegisteredAction(teamId: string, memberId: string) {
  try {
    await setTeamRegistered(teamId, memberId);
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resetRegisteredAction(teamId: string) {
  try {
    await adminResetRegistration(teamId);
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleFeePaidAction(teamId: string, memberId: string) {
  try {
    const isPaid = await toggleFeePayment(teamId, memberId);
    revalidatePath("/quizzes");
    return { success: true, isPaid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
