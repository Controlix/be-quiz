import { describe, it, expect } from "vitest";
import fs from "fs";

describe("QuizEntryForm European Date and Time Inputs", () => {
  it("does not use native type=date or type=time which render US format in English browsers", () => {
    const code = fs.readFileSync("src/components/QuizEntryForm.tsx", "utf-8");
    expect(code).not.toContain('type="date"');
    expect(code).not.toContain('type="time"');
  });

  it("provides European date and 24h time placeholders (DD/MM/JJJJ and 20:00)", () => {
    const code = fs.readFileSync("src/components/QuizEntryForm.tsx", "utf-8");
    expect(code).toContain("DD/MM/JJJJ");
    expect(code).toContain("20:00");
  });
});
