import { prisma } from "@/lib/db";
import { Rsvp, Member } from "@prisma/client";

export type RsvpWithDetails = Rsvp & {
  member: Member | null;
  invitedBy?: Member | null;
};

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
