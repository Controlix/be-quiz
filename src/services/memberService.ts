import { prisma } from "@/lib/db";
import type { Member } from "@prisma/client";

export async function updateMemberRole(
  targetMemberId: string,
  newRole: "USER" | "ADMIN",
  actorId: string
): Promise<Member> {
  if (targetMemberId === actorId && newRole === "USER") {
    throw new Error("Je kunt je eigen beheerder-rol niet intrekken.");
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.member.findUnique({
      where: { id: targetMemberId },
    });

    if (!target) {
      throw new Error("Lid niet gevonden.");
    }

    if (target.role === newRole) {
      return target;
    }

    if (newRole === "USER") {
      const adminCount = await tx.member.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        throw new Error("Er moet minstens één beheerder overblijven.");
      }
    }

    return tx.member.update({
      where: { id: targetMemberId },
      data: { role: newRole },
    });
  });
}
