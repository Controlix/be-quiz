import { describe, it, expect } from "vitest";
import { generateRegistrationMailto, getRegistrationEmailPlainText } from "../../src/lib/mailto";

describe("Mailto & Plaintext Email Generation", () => {
  const quiz = { title: "Herfstquiz", startsAt: new Date("2026-11-14T20:00:00Z"), organizerEmail: "org@quiz.be" };
  const team = { name: "Ben in Black" };

  it("produces clean unescaped text for clipboard with real newlines", () => {
    const text = getRegistrationEmailPlainText(quiz, team, "Marc");
    expect(text).not.toContain("%0D");
    expect(text).not.toContain("%20");
    expect(text).toContain("Ploegnaam: Ben in Black");
    expect(text).toContain("Contactpersoon: Marc");
  });

  it("produces single-encoded mailto URI without double-escapes (%250D)", () => {
    const uri = generateRegistrationMailto(quiz, team, "Marc");
    expect(uri.startsWith("mailto:org@quiz.be?")).toBe(true);
    expect(uri).not.toContain("%250D");
    expect(uri).not.toContain("%2520");
  });
});
