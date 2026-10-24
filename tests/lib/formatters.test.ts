import { describe, it, expect } from "vitest";
import {
  formatEuropeanDate,
  formatEuropeanTime,
  formatEuropeanDateTime,
} from "../../src/lib/formatters";

describe("European Date & Time Formatters", () => {
  const testDate = new Date("2026-11-14T20:05:00Z");

  it("formats date strictly as DD/MM/YYYY", () => {
    expect(formatEuropeanDate(testDate)).toBe("14/11/2026");
  });

  it("formats time strictly as 24-hour HH:mm", () => {
    expect(formatEuropeanTime(testDate)).toMatch(/^\d{2}:\d{2}$/);
    expect(formatEuropeanTime(testDate)).toBe("20:05");
  });

  it("formats combined datetime with Dutch weekday", () => {
    const formatted = formatEuropeanDateTime(testDate, true);
    expect(formatted).toContain("14/11/2026");
    expect(formatted).toContain("20:05");
  });
});
