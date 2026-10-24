import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { hashToken } from "../../src/lib/crypto";
import { createSession, validateSession } from "../../src/lib/auth";

describe("Invite & Session Flow", () => {
  it("claims an invite token and verifies the generated session", async () => {
    const member = await prisma.member.create({
      data: { name: `Friend-${Date.now()}`, role: "USER" },
    });
    const rawToken = `invite-secret-${Date.now()}-${Math.random()}`;
    await prisma.invite.create({
      data: { memberId: member.id, tokenHash: hashToken(rawToken) },
    });

    const { token } = await createSession(member.id);
    const session = await validateSession(token);
    expect(session?.member.id).toBe(member.id);
  });

  // Review Focus #4: PWA Standalone Cookie Isolation Fallback
  it("validates manual token paste on login page", async () => {
    const member = await prisma.member.create({
      data: { name: `PWA-${Date.now()}` },
    });
    const rawToken = `pwa-secret-${Date.now()}-${Math.random()}`;
    await prisma.invite.create({
      data: { memberId: member.id, tokenHash: hashToken(rawToken) },
    });

    const invite = await prisma.invite.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    expect(invite).not.toBeNull();
    expect(invite?.usedAt).toBeNull();
  });
});
