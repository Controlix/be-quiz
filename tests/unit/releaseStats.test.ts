import { describe, it, expect } from "vitest";
import { generateReleaseStats, renderAsciiBarChart } from "../../scripts/release-stats";

describe("generateReleaseStats", () => {
  it("returns release metrics across all git tags", () => {
    const stats = generateReleaseStats();

    expect(stats.length).toBeGreaterThanOrEqual(10);

    const v1 = stats.find((s) => s.tag === "v1.0.0");
    expect(v1).toBeDefined();
    expect(v1?.prodLines).toBeGreaterThan(0);
    expect(v1?.testLines).toBeGreaterThan(0);

    const latest = stats[stats.length - 1];
    expect(latest.tag).toMatch(/^v\d+\.\d+\.\d+/);
    expect(latest.prodLines).toBeGreaterThan(7000);
    expect(latest.testLines).toBeGreaterThan(4000);
  }, 30000);
});

describe("renderAsciiBarChart", () => {
  it("renders paired bars for each release", () => {
    const mockStats = [
      {
        tag: "v1.0.0",
        date: "2026-10-25",
        subject: "Initial",
        prodLines: 5000,
        testLines: 1000,
        ratio: "20.0%",
        testFileCount: 10,
        deltaProd: "-",
        deltaTest: "-",
      },
      {
        tag: "v2.0.0",
        date: "2026-11-01",
        subject: "Major",
        prodLines: 8000,
        testLines: 4000,
        ratio: "50.0%",
        testFileCount: 20,
        deltaProd: "+3000",
        deltaTest: "+3000",
      },
    ];

    const chart = renderAsciiBarChart(mockStats);
    expect(chart).toContain("v1.0.0");
    expect(chart).toContain("Prod");
    expect(chart).toContain("Test");
    expect(chart).toContain("█");
    expect(chart).toContain("▒");
    expect(chart).toContain("v2.0.0");
  });
});
