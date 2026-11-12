import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as auth from "@/lib/auth";
import AdminLayout from "@/app/admin/layout";

vi.mock("@/lib/auth");

describe("AdminLayout Access Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AdminUnauthorizedDialog when session is null", async () => {
    vi.spyOn(auth, "requireAdminSession").mockResolvedValue(null);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("renders AdminUnauthorizedDialog when user has role USER", async () => {
    vi.spyOn(auth, "requireAdminSession").mockResolvedValue(null);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("renders children when user has role ADMIN", async () => {
    vi.spyOn(auth, "requireAdminSession").mockResolvedValue({
      id: "admin-1",
      name: "Marc",
      role: "ADMIN",
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Protected Admin Content");
    expect(html).not.toContain("Toegang Gewijzigd");
  });
});
