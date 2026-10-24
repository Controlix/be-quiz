"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  verifyMemberPin,
  setMemberPin,
  resetMemberPin,
  createSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function loginWithPinAction(
  memberId: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const isValid = await verifyMemberPin(memberId, pin);
    if (!isValid) {
      return { success: false, error: "Ongeldige PIN. Probeer opnieuw." };
    }

    const { token, expiresAt } = await createSession(memberId);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij aanmelden." };
  }
}

export async function setupInitialPinAction(
  memberId: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { pinHash: true },
    });

    if (!member) {
      return { success: false, error: "Lid niet gevonden." };
    }

    if (member.pinHash) {
      return { success: false, error: "PIN is al ingesteld." };
    }

    await setMemberPin(memberId, pin);

    const { token, expiresAt } = await createSession(memberId);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij instellen van PIN." };
  }
}

export async function adminResetMemberPinAction(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await resetMemberPin(memberId);
    revalidatePath("/admin/members");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij resetten van PIN." };
  }
}
