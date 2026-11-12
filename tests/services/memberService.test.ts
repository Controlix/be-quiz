import { describe, it, expect, vi } from "vitest";
import { prisma } from "../../src/lib/db";
import { updateMemberRole } from "../../src/services/memberService";

describe("memberService.updateMemberRole", () => {
  it("rejects self-demotion when actorId equals targetMemberId and newRole is USER", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-Self-${Date.now()}`, role: "ADMIN" },
    });

    await expect(updateMemberRole(admin.id, "USER", admin.id)).rejects.toThrow(
      "Je kunt je eigen beheerder-rol niet intrekken."
    );
  });

  it("throws error when target member does not exist", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-Actor-${Date.now()}`, role: "ADMIN" },
    });

    await expect(updateMemberRole("non-existent-id", "ADMIN", admin.id)).rejects.toThrow(
      "Lid niet gevonden."
    );
  });

  it("returns existing member idempotently when target already has the requested role", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-Idempotent-${Date.now()}`, role: "ADMIN" },
    });
    const user = await prisma.member.create({
      data: { name: `User-Idempotent-${Date.now()}`, role: "USER" },
    });

    const resUser = await updateMemberRole(user.id, "USER", admin.id);
    expect(resUser.id).toBe(user.id);
    expect(resUser.role).toBe("USER");

    const otherAdmin = await prisma.member.create({
      data: { name: `Admin-Other-${Date.now()}`, role: "ADMIN" },
    });
    const resAdmin = await updateMemberRole(otherAdmin.id, "ADMIN", admin.id);
    expect(resAdmin.id).toBe(otherAdmin.id);
    expect(resAdmin.role).toBe("ADMIN");
  });

  it("rejects demoting an admin when they are the only administrator left", async () => {
    const admin = await prisma.member.create({
      data: { name: `Sole-Admin-${Date.now()}`, role: "ADMIN" },
    });
    const actor = await prisma.member.create({
      data: { name: `Other-Actor-${Date.now()}`, role: "USER" },
    });

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
      const mockTx = {
        member: {
          findUnique: () => Promise.resolve({ id: admin.id, role: "ADMIN" }),
          count: () => Promise.resolve(1),
          update: vi.fn(),
        },
      };
      return callback(mockTx);
    });

    try {
      await expect(updateMemberRole(admin.id, "USER", actor.id)).rejects.toThrow(
        "Er moet minstens één beheerder overblijven."
      );
    } finally {
      txSpy.mockRestore();
    }
  });

  it("successfully promotes a regular member to ADMIN", async () => {
    const admin = await prisma.member.create({
      data: { name: `Admin-Promoter-${Date.now()}`, role: "ADMIN" },
    });
    const user = await prisma.member.create({
      data: { name: `User-Candidate-${Date.now()}`, role: "USER" },
    });

    const updated = await updateMemberRole(user.id, "ADMIN", admin.id);
    expect(updated.id).toBe(user.id);
    expect(updated.role).toBe("ADMIN");

    const reloaded = await prisma.member.findUnique({ where: { id: user.id } });
    expect(reloaded?.role).toBe("ADMIN");
  });

  it("successfully demotes an admin to USER when multiple admins remain", async () => {
    const admin1 = await prisma.member.create({
      data: { name: `Admin-1-${Date.now()}`, role: "ADMIN" },
    });
    const admin2 = await prisma.member.create({
      data: { name: `Admin-2-${Date.now()}`, role: "ADMIN" },
    });

    const demoted = await updateMemberRole(admin2.id, "USER", admin1.id);
    expect(demoted.id).toBe(admin2.id);
    expect(demoted.role).toBe("USER");

    const reloaded = await prisma.member.findUnique({ where: { id: admin2.id } });
    expect(reloaded?.role).toBe("USER");
  });
});
