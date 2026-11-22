import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import AdminLayout from "@/app/admin/layout";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("AdminLayout Access Guard", () => {
  beforeEach(() => {
    // Use clearAllMocks (not resetAllMocks) to preserve update/delete resolved promises
    // so validateSession's `.catch(() => {})` never throws and gets swallowed by getSessionMember.
    vi.clearAllMocks();
  });

  it("renders AdminUnauthorizedDialog when session cookie is missing", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("renders AdminUnauthorizedDialog when session cookie token is unknown", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "unknown-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("unknown-token") },
      include: { member: true },
    });
    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("deletes expired session and renders AdminUnauthorizedDialog", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "expired-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "sess-expired",
      expiresAt: new Date(Date.now() - 60_000),
      member: { id: "admin-1", name: "Marc", role: "ADMIN" },
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: "sess-expired" } });
    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("renders AdminUnauthorizedDialog when user has role USER", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "raw-user-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "sess-user",
      expiresAt: new Date(Date.now() + 60_000),
      member: { id: "user-1", name: "Regular", role: "USER" },
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("raw-user-token") },
      include: { member: true },
    });
    expect(prisma.session.update).toHaveBeenCalledTimes(1);
    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("renders children when user has role ADMIN", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "raw-admin-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "sess-admin",
      expiresAt: new Date(Date.now() + 60_000),
      member: { id: "admin-1", name: "Marc", role: "ADMIN" },
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("raw-admin-token") },
      include: { member: true },
    });
    expect(prisma.session.update).toHaveBeenCalledTimes(1);
    expect(html).toContain("Protected Admin Content");
    expect(html).not.toContain("Toegang Gewijzigd");
  });
});
