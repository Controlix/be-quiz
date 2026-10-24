import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { verifyMemberPin, setMemberPin, resetMemberPin } from "../../src/lib/auth";
import { adminResetMemberPinAction } from "../../src/actions/authActions";

describe("Name + 4-Digit PIN Authentication", () => {
  it("sets a 4-digit PIN for a new member and verifies it", async () => {
    const member = await prisma.member.create({
      data: { name: `PIN-User-${Date.now()}`, role: "USER" },
    });

    await setMemberPin(member.id, "4821");
    const isValid = await verifyMemberPin(member.id, "4821");
    const isInvalid = await verifyMemberPin(member.id, "0000");

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });

  it("resets a member PIN successfully", async () => {
    const member = await prisma.member.create({
      data: { name: `PIN-Reset-${Date.now()}`, role: "USER" },
    });

    await setMemberPin(member.id, "1234");
    expect(await verifyMemberPin(member.id, "1234")).toBe(true);

    await resetMemberPin(member.id);
    expect(await verifyMemberPin(member.id, "1234")).toBe(false);

    const refreshed = await prisma.member.findUnique({ where: { id: member.id } });
    expect(refreshed?.pinHash).toBeNull();
  });
});
