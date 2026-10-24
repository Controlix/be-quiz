import { prisma } from "@/lib/db";
import { Rsvp, Member } from "@prisma/client";

export type RsvpWithMember = Rsvp & { member: Member };

export async function getRsvpLineup(
  teamId: string
): Promise<{ active: RsvpWithMember[]; reserves: RsvpWithMember[] }> {
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
  await prisma.$transaction(async (tx) => {
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
  });
}

export async function adminOverrideDecline(
  teamId: string,
  memberId: string,
  adminId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
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
  });
}

export async function updateTeamCapacity(
  teamId: string,
  newMaxTeamSize: number
): Promise<void> {
  if (newMaxTeamSize < 1 || newMaxTeamSize > 10) {
    throw new Error("Ploeggrootte moet tussen 1 en 10 liggen");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

    await tx.team.update({
      where: { id: teamId },
      data: {
        maxTeamSize: newMaxTeamSize,
      },
    });
  });
}

export async function reorderRsvps(
  teamId: string,
  sourceIndex: number,
  destinationIndex: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
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
      return;
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
  });
}
