import { describe, it, expect, vi } from "vitest";
import { generateReleaseStats, renderAsciiBarChart } from "../../scripts/release-stats";

vi.mock("child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes('git tag -l "v*"')) {
      return [
        "v1.0.0",
        "v1.1.0",
        "v1.2.0",
        "v1.3.0",
        "v1.4.0",
        "v2.0.0",
        "v2.1.0",
        "v2.2.0",
        "v2.3.0",
        "v2.6.0",
      ].join("\n");
    }
    if (cmd.includes('git log -1 --format="%as"')) {
      return "2026-10-25\n";
    }
    if (cmd.includes('git tag -l --format="%(contents:subject)"')) {
      return "Release: Initial tag\n";
    }
    if (cmd.includes('git log -1 --format="%s"')) {
      return "Initial commit\n";
    }
    if (cmd.includes("git ls-tree -r --name-only")) {
      return "src/index.ts\ntests/index.test.ts\n";
    }
    if (cmd.includes('git show "v2.6.0":"src/index.ts"')) {
      return "const x = 1;\n".repeat(7500);
    }
    if (cmd.includes('git show "v2.6.0":"tests/index.test.ts"')) {
      return "const t = 1;\n".repeat(4500);
    }
    if (cmd.includes("git show") && cmd.includes("src/index.ts")) {
      return "const x = 1;\n".repeat(1000);
    }
    if (cmd.includes("git show") && cmd.includes("tests/index.test.ts")) {
      return "const t = 1;\n".repeat(500);
    }
    return "";
  }),
}));

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
  });
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
