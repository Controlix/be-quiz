"use server";

import { prisma } from "@/lib/db";
import { hashToken, generateSecureToken } from "@/lib/crypto";
import { adminOverrideDecline, updateTeamCapacity } from "@/services/rsvpService";
import { adminResetRegistration } from "@/services/registrationService";
import { revalidatePath } from "next/cache";

export async function adminCancelQuizAction(quizId: string) {
  try {
    await prisma.quiz.update({
      where: { id: quizId },
      data: { status: "CANCELLED" },
    });
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminResetRegistrationAction(teamId: string) {
  try {
    await adminResetRegistration(teamId);
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminOverrideDeclineAction(teamId: string, memberId: string, adminId: string) {
  try {
    await adminOverrideDecline(teamId, memberId, adminId);
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminUpdateTeamCapacityAction(teamId: string, newMaxTeamSize: number) {
  try {
    await updateTeamCapacity(teamId, newMaxTeamSize);
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminAddMemberAction(name: string) {
  try {
    const member = await prisma.member.create({
      data: {
        name,
        role: "USER",
      },
    });

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    await prisma.invite.create({
      data: {
        memberId: member.id,
        tokenHash,
      },
    });

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/auth/join?token=${rawToken}`;

    revalidatePath("/admin/members");
    return { success: true, inviteUrl, memberId: member.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminUpdateDefaultTeamNameAction(newName: string) {
  try {
    await prisma.teamSetting.upsert({
      where: { id: "singleton" },
      update: { defaultTeamName: newName },
      create: { id: "singleton", defaultTeamName: newName },
    });
    revalidatePath("/quizzes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
