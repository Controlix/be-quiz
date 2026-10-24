import { describe, it, expect } from "vitest";
import { parseVisionExtractionResponse } from "../../src/services/visionService";

describe("Vision Extraction Markdown Handling", () => {
  it("parses JSON wrapped in markdown code blocks", () => {
    const rawAiOutput = "```json\n" + JSON.stringify({
      title: "Café Quiz",
      date: "2026-11-20",
      time: "20:00",
      location: "Gent",
      maxTeamSize: 4,
      entryFee: "€20 / ploeg"
    }) + "\n```";

    const result = parseVisionExtractionResponse(rawAiOutput);
    expect(result.isValid).toBe(true);
    expect(result.data.title).toBe("Café Quiz");
    expect(result.data.location).toBe("Gent");
  });
});
