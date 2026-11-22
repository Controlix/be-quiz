import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Knip Configuration Contract (Phase 2)", () => {
  const rootDir = process.cwd();
  const knipConfigPath = path.join(rootDir, "knip.json");
  const packageJsonPath = path.join(rootDir, "package.json");

  it("enables ignoreExportsUsedInFile, configures Secretlint ignoreDependencies, and gates check:all on knip + prod", () => {
    const knipConfig = JSON.parse(fs.readFileSync(knipConfigPath, "utf8"));
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    expect(knipConfig.$schema).toBe("https://unpkg.com/knip@6/schema.json");
    expect(knipConfig.ignore).toEqual([]);
    expect(knipConfig.ignoreExportsUsedInFile).toBe(true);
    expect(knipConfig.ignoreDependencies).toEqual(["@secretlint/secretlint-rule-preset-recommend"]);

    expect(typeof pkg.devDependencies?.knip).toBe("string");
    expect(pkg.scripts?.knip).toBe("knip");
    expect(pkg.scripts?.["knip:prod"]).toBe("knip --production");
    expect(pkg.scripts?.["check:all"]).toContain("npm run knip");
    expect(pkg.scripts?.["check:all"]).toContain("npm run knip:prod");
  });

  it("includes CSS stylesheets, scripts, prisma, and tests in knip.json project scope", () => {
    const knipConfig = JSON.parse(fs.readFileSync(knipConfigPath, "utf8"));

    expect(knipConfig.entry).toEqual(["scripts/**/*.ts"]);
    expect(knipConfig.project).toEqual([
      "src/**/*.{ts,tsx,css}!",
      "scripts/**/*.ts",
      "prisma/**/*.{ts,prisma}",
      "tests/**/*.{ts,tsx}",
    ]);
  });
});
