import { describe, it, expect } from "vitest";
import { validateQuizFields } from "../../src/services/quizService";

describe("Quiz Input Validation", () => {
  it("rejects overlong titles or locations", () => {
    const longTitle = "A".repeat(101);
    const valid = validateQuizFields({ title: longTitle, location: "Gent" });
    expect(valid.isValid).toBe(false);
    expect(valid.errors.title).toBeDefined();
  });

  it("rejects invalid email formats", () => {
    const invalidEmail = validateQuizFields({ title: "Quiz", location: "Gent", organizerEmail: "invalid-email" });
    expect(invalidEmail.isValid).toBe(false);
    expect(invalidEmail.errors.organizerEmail).toBeDefined();
  });

  it("accepts valid email and lengths", () => {
    const valid = validateQuizFields({ title: "Quiz", location: "Gent", organizerEmail: "organisatie@quiz.be" });
    expect(valid.isValid).toBe(true);
  });
});
