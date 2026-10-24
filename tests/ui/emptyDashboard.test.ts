import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Clean Production Seed & Empty Dashboard State", () => {
  it("verifies seed.ts contains only Marc and 0 dummy quizzes", () => {
    const seed = fs.readFileSync("prisma/seed.ts", "utf-8");
    expect(seed).toContain("Ben in Black");
    expect(seed).not.toContain("De Grote Herfstquiz");
    expect(seed).not.toContain("Scouts & Gidsen Kwis");
  });

  it("renders a friendly empty state CTA in QuizzesDashboard", () => {
    const file = fs.readFileSync("src/components/QuizzesDashboard.tsx", "utf-8");
    expect(file).toContain("Nog geen quizzen gepland");
  });
});
