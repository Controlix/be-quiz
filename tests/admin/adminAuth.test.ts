import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { adminResetMemberPinAction } from "../../src/actions/authActions";
import { adminUpdateTeamCapacityAction } from "../../src/actions/adminActions";
import { adminReorderRsvpAction } from "../../src/actions/reorderActions";

describe("Admin Authorization Verification", () => {
  it("rejects unauthenticated adminResetMemberPinAction", async () => {
    const member = await prisma.member.create({
      data: { name: `NonAdmin-${Date.now()}`, role: "USER" },
    });
    const res = await adminResetMemberPinAction(member.id);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Niet geautoriseerd|Niet gemachtigd/i);
  });

  it("rejects unauthenticated adminUpdateTeamCapacityAction", async () => {
    const res = await adminUpdateTeamCapacityAction("mock-team", 4);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Niet geautoriseerd|Niet gemachtigd/i);
  });

  it("rejects unauthenticated adminReorderRsvpAction", async () => {
    const res = await adminReorderRsvpAction("mock-team", 0, 1);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Niet geautoriseerd|Niet gemachtigd/i);
  });
});
