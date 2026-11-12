import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberRosterClient } from "@/components/MemberRosterClient";

describe("MemberRosterClient - Partitioned Roles UI", () => {
  const mockMembers = [
    { id: "admin-1", name: "Marc (Admin)", role: "ADMIN" },
    { id: "admin-2", name: "Laura (Admin)", role: "ADMIN" },
    { id: "user-1", name: "Thomas (User)", role: "USER" },
    { id: "user-2", name: "Sarah (User)", role: "USER" },
  ];

  it("renders distinct Beheerders and Leden section headers with correct counts", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberRosterClient, {
        initialMembers: mockMembers,
        currentMemberId: "admin-1",
      })
    );

    expect(html).toContain("Beheerders (2)");
    expect(html).toContain("Leden (2)");
  });

  it("renders (Jij) badge for current logged-in admin and omits demote action on their row", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberRosterClient, {
        initialMembers: mockMembers,
        currentMemberId: "admin-1",
      })
    );

    expect(html).toContain("JIJ");
    // Marc (Admin) row should not have demote button
    expect(html).toContain("Geen zelf-degradatie");
  });

  it("renders '↓ Naar Leden' button on other admin rows", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberRosterClient, {
        initialMembers: mockMembers,
        currentMemberId: "admin-1",
      })
    );

    expect(html).toContain("Naar Leden");
  });

  it("renders '↑ Maak Beheerder' button on regular member rows", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberRosterClient, {
        initialMembers: mockMembers,
        currentMemberId: "admin-1",
      })
    );

    expect(html).toContain("Maak Beheerder");
  });

  it("does not use window.confirm anywhere in MemberRosterClient", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/components/MemberRosterClient.tsx", "utf-8");
    expect(source).not.toContain("window.confirm");
  });
});
