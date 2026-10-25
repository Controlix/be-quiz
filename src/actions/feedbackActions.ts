"use server";

import { prisma } from "@/lib/db";
import { getSessionMember } from "@/lib/auth";
import { saveUploadedFeedbackImage, deleteFeedbackImage } from "@/lib/feedbackStorage";
import { FeedbackCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function submitFeedbackAction(formData: FormData) {
  try {
    const rawMessage = (formData.get("message") as string) || "";
    const message = rawMessage.trim();

    if (message.length < 3) {
      return { success: false, error: "Bericht is te kort (minimaal 3 tekens)." };
    }

    const rawCategory = (formData.get("category") as string) || "BUG";
    let category: FeedbackCategory = FeedbackCategory.BUG;
    if (rawCategory === "IDEA") {
      category = FeedbackCategory.IDEA;
    } else if (rawCategory === "QUESTION") {
      category = FeedbackCategory.QUESTION;
    }

    const pageUrl = (formData.get("pageUrl") as string) || "/";
    const userAgent = (formData.get("userAgent") as string) || null;

    let memberId: string | null = null;
    try {
      const currentMember = await getSessionMember();
      if (currentMember) {
        memberId = currentMember.id;
      }
    } catch {}

    let screenshotUrl: string | null = null;
    const file = formData.get("screenshot") as File | null;
    if (file && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return { success: false, error: "Afbeelding is te groot (maximaal 5MB)." };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "image/jpeg";
      screenshotUrl = await saveUploadedFeedbackImage(buffer, mimeType);
    }

    const feedback = await prisma.feedback.create({
      data: {
        category,
        message,
        pageUrl,
        userAgent,
        screenshot: screenshotUrl,
        memberId,
      },
    });

    try {
      revalidatePath("/admin/feedback");
      revalidatePath("/admin");
    } catch {}

    return { success: true, feedbackId: feedback.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij opslaan van feedback." };
  }
}

export async function toggleFeedbackResolvedAction(feedbackId: string) {
  try {
    const currentMember = await getSessionMember().catch(() => null);
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    const existing = await prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!existing) {
      return { success: false, error: "Feedback item niet gevonden." };
    }

    const nextResolved = !existing.isResolved;
    const updated = await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        isResolved: nextResolved,
        resolvedAt: nextResolved ? new Date() : null,
      },
    });

    try {
      revalidatePath("/admin/feedback");
      revalidatePath("/admin");
    } catch {}

    return { success: true, isResolved: updated.isResolved };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij bijwerken van status." };
  }
}

export async function deleteFeedbackAction(feedbackId: string) {
  try {
    const currentMember = await getSessionMember().catch(() => null);
    if (!currentMember || currentMember.role !== "ADMIN") {
      return { success: false, error: "Niet geautoriseerd." };
    }

    const existing = await prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!existing) {
      return { success: false, error: "Feedback item niet gevonden." };
    }

    if (existing.screenshot) {
      await deleteFeedbackImage(existing.screenshot);
    }

    await prisma.feedback.delete({
      where: { id: feedbackId },
    });

    try {
      revalidatePath("/admin/feedback");
      revalidatePath("/admin");
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij verwijderen." };
  }
}
