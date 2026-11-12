import { prisma } from "@/lib/db";
import { Rsvp, Member } from "@prisma/client";
import { domainEvents } from "@/lib/events";

export type RsvpWithDetails = Rsvp & {
  member: Member | null;
  invitedBy?: Member | null;
};
export type RsvpWithMember = RsvpWithDetails;

export async function getRsvpLineup(
  teamId: string
): Promise<{ active: RsvpWithDetails[]; reserves: RsvpWithDetails[] }> {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { maxTeamSize: true },
  });

  const attendingRsvps = await prisma.rsvp.findMany({
    where: {
      teamId,
      status: "ATTENDING",
    },
    include: {
      member: true,
      invitedBy: true,
    },
    orderBy: {
      queuedSince: "asc",
    },
  });

  return {
    active: attendingRsvps.slice(0, team.maxTeamSize),
    reserves: attendingRsvps.slice(team.maxTeamSize),
  };
}

export async function setRsvp(
  teamId: string,
  memberId: string,
  status: "ATTENDING" | "DECLINED"
): Promise<void> {
  const team = await prisma.$transaction(async (tx) => {
    // Acquire row-level lock on Team to serialize concurrent RSVPs
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    if (status === "ATTENDING") {
      await tx.rsvp.upsert({
        where: {
          teamId_memberId: {
            teamId,
            memberId,
          },
        },
        update: {
          status: "ATTENDING",
          queuedSince: new Date(),
          overriddenById: null,
          overriddenAt: null,
        },
        create: {
          teamId,
          memberId,
          status: "ATTENDING",
          queuedSince: new Date(),
        },
      });
    } else {
      await tx.rsvp.upsert({
        where: {
          teamId_memberId: {
            teamId,
            memberId,
          },
        },
        update: {
          status: "DECLINED",
          queuedSince: null,
        },
        create: {
          teamId,
          memberId,
          status: "DECLINED",
          queuedSince: null,
        },
      });
    }

    return tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { quizId: true },
    });
  });

  domainEvents.emit({
    type: "team.roster_changed",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function adminOverrideDecline(
  teamId: string,
  memberId: string,
  adminId: string
): Promise<void> {
  const team = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    await tx.rsvp.upsert({
      where: {
        teamId_memberId: {
          teamId,
          memberId,
        },
      },
      update: {
        status: "DECLINED",
        queuedSince: null,
        overriddenById: adminId,
        overriddenAt: new Date(),
      },
      create: {
        teamId,
        memberId,
        status: "DECLINED",
        queuedSince: null,
        overriddenById: adminId,
        overriddenAt: new Date(),
      },
    });

    return tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { quizId: true },
    });
  });

  domainEvents.emit({
    type: "team.roster_changed",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function adminOverrideAttend(
  teamId: string,
  memberId: string,
  adminId: string
): Promise<void> {
  const team = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    await tx.rsvp.upsert({
      where: {
        teamId_memberId: {
          teamId,
          memberId,
        },
      },
      update: {
        status: "ATTENDING",
        queuedSince: new Date(),
        overriddenById: adminId,
        overriddenAt: new Date(),
      },
      create: {
        teamId,
        memberId,
        status: "ATTENDING",
        queuedSince: new Date(),
        overriddenById: adminId,
        overriddenAt: new Date(),
      },
    });

    return tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { quizId: true },
    });
  });

  domainEvents.emit({
    type: "team.roster_changed",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function updateTeamCapacity(teamId: string, newMaxTeamSize: number): Promise<void> {
  if (newMaxTeamSize < 1 || newMaxTeamSize > 10) {
    throw new Error("Ploeggrootte moet tussen 1 en 10 liggen");
  }

  const team = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    return tx.team.update({
      where: { id: teamId },
      data: {
        maxTeamSize: newMaxTeamSize,
      },
      select: { quizId: true },
    });
  });

  domainEvents.emit({
    type: "team.roster_changed",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}

export async function addGuestRsvp(
  teamId: string,
  guestName: string,
  invitedById: string
): Promise<Rsvp & { invitedBy: Member | null }> {
  const trimmed = guestName?.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length === 0 || trimmed.length > 50) {
    throw new Error("Naam van de gastspeler moet tussen 1 en 50 tekens zijn.");
  }

  const { rsvp, quizId } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    const existing = await tx.rsvp.findFirst({
      where: {
        teamId,
        invitedById,
        status: "ATTENDING",
        guestName: {
          equals: trimmed,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw new Error("Gast met deze naam is al toegevoegd door jou.");
    }

    const created = await tx.rsvp.create({
      data: {
        teamId,
        guestName: trimmed,
        invitedById,
        status: "ATTENDING",
        queuedSince: new Date(),
      },
      include: {
        invitedBy: true,
      },
    });

    const team = await tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { quizId: true },
    });

    return { rsvp: created, quizId: team.quizId };
  });

  domainEvents.emit({
    type: "team.roster_changed",
    quizId,
    occurredAt: new Date(),
  });

  return rsvp;
}

export async function removeGuestRsvp(
  rsvpId: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  const initialTarget = await prisma.rsvp.findUnique({
    where: { id: rsvpId },
    select: { teamId: true },
  });

  if (!initialTarget) {
    throw new Error("Gast niet gevonden");
  }

  const quizId = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${initialTarget.teamId} FOR UPDATE`;

    const target = await tx.rsvp.findUnique({
      where: { id: rsvpId },
      select: {
        id: true,
        teamId: true,
        guestName: true,
        invitedById: true,
      },
    });

    if (!target || !target.guestName) {
      throw new Error("Gast niet gevonden");
    }

    if (actorRole !== "ADMIN" && target.invitedById !== actorId) {
      throw new Error("Geen toegang om deze gast te verwijderen");
    }

    await tx.rsvp.delete({
      where: { id: rsvpId },
    });

    const team = await tx.team.findUniqueOrThrow({
      where: { id: target.teamId },
      select: { quizId: true },
    });

    return team.quizId;
  });

  domainEvents.emit({
    type: "team.roster_changed",
    quizId,
    occurredAt: new Date(),
  });
}

export async function reorderRsvps(
  teamId: string,
  sourceIndex: number,
  destinationIndex: number
): Promise<void> {
  const team = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    const attendingRsvps = await tx.rsvp.findMany({
      where: {
        teamId,
        status: "ATTENDING",
      },
      orderBy: {
        queuedSince: "asc",
      },
    });

    if (
      sourceIndex < 0 ||
      sourceIndex >= attendingRsvps.length ||
      destinationIndex < 0 ||
      destinationIndex >= attendingRsvps.length ||
      sourceIndex === destinationIndex
    ) {
      return tx.team.findUniqueOrThrow({
        where: { id: teamId },
        select: { quizId: true },
      });
    }

    const reordered = [...attendingRsvps];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, moved);

    const baseTime = attendingRsvps[0].queuedSince
      ? new Date(attendingRsvps[0].queuedSince).getTime()
      : Date.now() - attendingRsvps.length * 1000;

    for (let i = 0; i < reordered.length; i++) {
      const newQueuedSince = new Date(baseTime + i * 1000);
      await tx.rsvp.update({
        where: { id: reordered[i].id },
        data: { queuedSince: newQueuedSince },
      });
    }

    return tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { quizId: true },
    });
  });

  domainEvents.emit({
    type: "team.roster_changed",
    quizId: team.quizId,
    occurredAt: new Date(),
  });
}
