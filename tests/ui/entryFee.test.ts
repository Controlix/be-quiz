import { describe, it, expect } from "vitest";
import { formatStructuredEntryFee } from "../../src/services/quizService";

describe("Structured Entry Fee Formatter", () => {
  it("formats team entry fee with Euro symbol and per ploeg", () => {
    expect(formatStructuredEntryFee("20", "TEAM")).toBe("€20 / ploeg");
  });

  it("formats per person entry fee correctly", () => {
    expect(formatStructuredEntryFee("5", "PERSON")).toBe("€5 / persoon");
  });

  it("returns undefined when amount is empty", () => {
    expect(formatStructuredEntryFee("", "TEAM")).toBeUndefined();
  });
});
