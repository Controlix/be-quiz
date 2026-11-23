import { describe, it, expect } from "vitest";
import { formatStructuredEntryFee, parseStructuredEntryFee } from "../../src/services/quizService";

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

  it("parses formatted team and person entry fees back into amount and unit", () => {
    expect(parseStructuredEntryFee("€20 / ploeg")).toEqual({ amount: "20", unit: "TEAM" });
    expect(parseStructuredEntryFee("€5 / persoon")).toEqual({ amount: "5", unit: "PERSON" });
    expect(parseStructuredEntryFee("15 pp")).toEqual({ amount: "15", unit: "PERSON" });
    expect(parseStructuredEntryFee("€12,50 p.p.")).toEqual({ amount: "12,50", unit: "PERSON" });
  });

  it("returns empty amount and TEAM default for null, empty, or non-numeric strings", () => {
    expect(parseStructuredEntryFee(null)).toEqual({ amount: "", unit: "TEAM" });
    expect(parseStructuredEntryFee("")).toEqual({ amount: "", unit: "TEAM" });
    expect(parseStructuredEntryFee("gratis")).toEqual({ amount: "", unit: "TEAM" });
  });
});
