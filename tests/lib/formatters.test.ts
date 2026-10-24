import { describe, it, expect } from "vitest";
import {
  formatEuropeanDate,
  formatEuropeanTime,
  formatEuropeanDateTime,
  formatEuropeanDateString,
  formatEuropeanTimeString,
  parseEuropeanDateTime,
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

  it("formats ISO date string (YYYY-MM-DD) into European DD/MM/YYYY input string", () => {
    expect(formatEuropeanDateString("2026-11-20")).toBe("20/11/2026");
    expect(formatEuropeanDateString("20112026")).toBe("20/11/2026");
  });

  it("formats time string into HH:mm", () => {
    expect(formatEuropeanTimeString("2000")).toBe("20:00");
    expect(formatEuropeanTimeString("19:30")).toBe("19:30");
  });

  it("parses DD/MM/YYYY and HH:mm into Date object", () => {
    const date = parseEuropeanDateTime("20/11/2026", "20:00");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10); // 0-indexed November
    expect(date?.getDate()).toBe(20);
    expect(date?.getHours()).toBe(20);
    expect(date?.getMinutes()).toBe(0);
  });
});
