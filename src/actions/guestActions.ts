"use server";

import { getSessionMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addGuestRsvp, removeGuestRsvp } from "@/services/rsvpService";
import { revalidatePath } from "next/cache";

export type GuestActionResult =
  | {
      success: true;
      rsvp: {
        id: string;
        guestName: string;
        invitedById: string;
        invitedByName: string;
        queuedSince: Date;
      };
    }
  | {
      success: false;
      error: string;
    };

export async function addGuestAction(
  teamId: string,
  guestName: string
): Promise<GuestActionResult> {
  try {
    const sessionMember = await getSessionMember();
    if (!sessionMember) {
      return { success: false, error: "Niet ingelogd" };
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { quiz: true },
    });

    if (!team) {
      return { success: false, error: "Ploeg niet gevonden" };
    }

    const isStarted = new Date(team.quiz.startsAt).getTime() <= Date.now();
    if (isStarted && sessionMember.role !== "ADMIN") {
      return {
        success: false,
        error: "Quiz is al gestart en vergrendeld voor wijzigingen.",
      };
    }

    const rsvp = await addGuestRsvp(teamId, guestName, sessionMember.id);

    revalidatePath(`/quizzes/${team.quizId}`);
    revalidatePath("/quizzes");

    return {
      success: true,
      rsvp: {
        id: rsvp.id,
        guestName: rsvp.guestName!,
        invitedById: rsvp.invitedById!,
        invitedByName: rsvp.invitedBy?.name || sessionMember.name,
        queuedSince: rsvp.queuedSince || new Date(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij toevoegen van gast" };
  }
}

export async function removeGuestAction(
  rsvpId: string,
  _teamId?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const sessionMember = await getSessionMember();
    if (!sessionMember) {
      return { success: false, error: "Niet ingelogd" };
    }

    const rsvp = await prisma.rsvp.findUnique({
      where: { id: rsvpId },
      include: {
        team: {
          include: { quiz: true },
        },
      },
    });

    if (!rsvp || !rsvp.guestName || !rsvp.team) {
      return { success: false, error: "Gast niet gevonden" };
    }

    const isStarted = new Date(rsvp.team.quiz.startsAt).getTime() <= Date.now();
    if (isStarted && sessionMember.role !== "ADMIN") {
      return {
        success: false,
        error: "Quiz is al gestart en vergrendeld voor wijzigingen.",
      };
    }

    await removeGuestRsvp(rsvpId, sessionMember.id, sessionMember.role);

    revalidatePath(`/quizzes/${rsvp.team.quizId}`);
    revalidatePath("/quizzes");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij verwijderen van gast" };
  }
}
