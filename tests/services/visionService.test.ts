import { describe, it, expect } from "vitest";
import { parseVisionExtractionResponse } from "../../src/services/visionService";

describe("Vision Extraction Validation & Error Handling", () => {
  it("flags missing location or maxTeamSize as invalid", () => {
    const rawAiOutput = JSON.stringify({
      title: "Café Quiz",
      date: "2026-11-20",
      time: "20:00",
      location: null,
      maxTeamSize: null,
      organizerEmail: "info@cafe.be",
    });
    const result = parseVisionExtractionResponse(rawAiOutput);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain("location");
    expect(result.missingFields).toContain("maxTeamSize");
  });

  // Review Focus #1: Vision AI 15s Timeout / 5xx Fallback
  it("handles provider timeout or 5xx gracefully without throwing", () => {
    const timeoutResult = parseVisionExtractionResponse("TIMEOUT");
    expect(timeoutResult.isValid).toBe(false);
    expect(timeoutResult.error).toContain("time-out");
  });
});
