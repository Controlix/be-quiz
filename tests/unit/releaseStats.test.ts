import { describe, it, expect } from "vitest";
import { generateReleaseStats } from "../../scripts/release-stats";

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
