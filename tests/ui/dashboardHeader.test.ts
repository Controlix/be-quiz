import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Dashboard Header & Currency Symbols", () => {
  it("includes a link to /auth/logout in QuizzesDashboard", () => {
    const file = fs.readFileSync("src/components/QuizzesDashboard.tsx", "utf-8");
    expect(file).toContain("/auth/logout");
  });

  it("replaces DollarSign with Euro glyph in ActionToolbar", () => {
    const file = fs.readFileSync("src/components/ActionToolbar.tsx", "utf-8");
    expect(file).not.toContain("DollarSign");
    expect(file).toContain("€");
  });
});
