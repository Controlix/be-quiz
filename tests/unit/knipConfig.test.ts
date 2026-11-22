import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Knip Configuration Contract (Phase 1)", () => {
  const rootDir = process.cwd();
  const knipConfigPath = path.join(rootDir, "knip.json");
  const packageJsonPath = path.join(rootDir, "package.json");

  it("uses Knip v6 JSON schema and keeps ignore and ignoreDependencies empty in Phase 1", () => {
    const knipConfig = JSON.parse(fs.readFileSync(knipConfigPath, "utf8"));

    expect(knipConfig.$schema).toBe("https://unpkg.com/knip@6/schema.json");
    expect(knipConfig.ignore).toEqual([]);
    expect(knipConfig.ignoreDependencies).toEqual([]);
  });

  it("includes CSS stylesheets, scripts, prisma, and tests in knip.json project scope", () => {
    const knipConfig = JSON.parse(fs.readFileSync(knipConfigPath, "utf8"));

    expect(knipConfig.entry).toEqual(["scripts/**/*.ts"]);
    expect(knipConfig.project).toEqual([
      "src/**/*.{ts,tsx,css}!",
      "scripts/**/*.ts",
      "prisma/**/*.ts",
      "tests/**/*.{ts,tsx}",
    ]);
  });

  it("installs knip in devDependencies and defines knip and knip:prod scripts without gating check:all", () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    expect(typeof pkg.devDependencies?.knip).toBe("string");
    expect(pkg.scripts?.knip).toBe("knip");
    expect(pkg.scripts?.["knip:prod"]).toBe("knip --production");
    expect(pkg.scripts?.["check:all"]).not.toContain("knip");
  });
});

describe("Knip Baseline Audit Report", () => {
  const reportPath = path.join(process.cwd(), "docs/superpowers/audit/knip-baseline-report.md");

  it("documents both default mode and production mode sections in knip-baseline-report.md", () => {
    const report = fs.readFileSync(reportPath, "utf8");

    expect(report).toContain("npm run knip");
    expect(report).toContain("npm run knip:prod");
  });

  it("records all four required audit categories and classifies Secretlint plugin gaps", () => {
    const report = fs.readFileSync(reportPath, "utf8");

    expect(report).toMatch(/unused files/i);
    expect(report).toMatch(/unused exports/i);
    expect(report).toMatch(/unused dependencies/i);
    expect(report).toMatch(/unlisted dependencies/i);
    expect(report).toContain(".secretlintrc.json");
    expect(report).toContain("@secretlint/secretlint-rule-preset-recommend");
    expect(report).toMatch(/Phase 1/i);
  });
});
