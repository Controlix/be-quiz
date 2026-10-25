import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Admin Navigation Header & Admin Page", () => {
  it("renders Beheer link to /admin in QuizzesDashboard when isAdmin", () => {
    const file = fs.readFileSync("src/components/QuizzesDashboard.tsx", "utf-8");
    expect(file).toContain("isAdmin");
    expect(file).toContain('href="/admin"');
    expect(file).toContain("Beheer");
  });

  it("passes isAdmin from /quizzes/page.tsx to QuizzesDashboard", () => {
    const file = fs.readFileSync("src/app/quizzes/page.tsx", "utf-8");
    expect(file).toContain("isAdmin=");
  });

  it("creates /admin/page.tsx with links to feedback, members, and settings", () => {
    const file = fs.readFileSync("src/app/admin/page.tsx", "utf-8");
    expect(file).toContain('href="/admin/feedback"');
    expect(file).toContain('href="/admin/members"');
    expect(file).toContain('href="/admin/settings"');
  });
});
