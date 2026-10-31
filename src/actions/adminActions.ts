"use server";

import { prisma } from "@/lib/db";
import { hashToken, generateSecureToken } from "@/lib/crypto";
import { getSessionMember } from "@/lib/auth";
import { adminOverrideDecline, adminOverrideAttend, updateTeamCapacity } from "@/services/rsvpService";
import { adminResetRegistration } from "@/services/registrationService";
import { revalidatePath } from "next/cache";

import { adminResetMemberPinAction } from "@/actions/authActions";
import { getAppOriginFromHeaders } from "@/lib/requestUrl";
export { adminResetMemberPinAction };

export async function adminCancelQuizAction(quizId: string) {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    await prisma.quiz.update({
      where: { id: quizId },
      data: { status: "CANCELLED" },
    });
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminResetRegistrationAction(teamId: string) {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    await adminResetRegistration(teamId);
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminOverrideDeclineAction(teamId: string, memberId: string, adminId: string) {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    await adminOverrideDecline(teamId, memberId, adminId);
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminUpdateTeamCapacityAction(teamId: string, newMaxTeamSize: number) {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    if (newMaxTeamSize < 1 || newMaxTeamSize > 10) {
      return { success: false, error: "Ploeggrootte moet tussen 1 en 10 liggen" };
    }
    await updateTeamCapacity(teamId, newMaxTeamSize);
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminAddMemberAction(name: string) {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

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

    const appUrl = await getAppOriginFromHeaders();
    const inviteUrl = `${appUrl}/auth/join?token=${rawToken}`;

    try {
      revalidatePath("/admin/members");
    } catch {}
    return { success: true, inviteUrl, memberId: member.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminUpdateDefaultTeamNameAction(newName: string) {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    await prisma.teamSetting.upsert({
      where: { id: "singleton" },
      update: { defaultTeamName: newName },
      create: { id: "singleton", defaultTeamName: newName },
    });
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminOverrideAttendAction(
  teamId: string,
  memberId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentMember = await getSessionMember();
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    await adminOverrideAttend(teamId, memberId, adminId);
    try {
      revalidatePath("/quizzes");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
