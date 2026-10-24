import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";

describe("Database Connection & Models", () => {
  it("queries the team settings singleton from postgres", async () => {
    const setting = await prisma.teamSetting.findUnique({ where: { id: "singleton" } });
    expect(setting?.defaultTeamName).toBeDefined();
  });
});
