import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDefaultTeamName } from "@/services/quizService";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    teamSetting: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getDefaultTeamName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns configured team name when TeamSetting exists", async () => {
    (prisma.teamSetting.findUnique as any).mockResolvedValue({
      id: "singleton",
      defaultTeamName: "Ben in Black",
    });

    const result = await getDefaultTeamName();
    expect(result).toBe("Ben in Black");
  });

  it("falls back to 'KwisVrienden' when TeamSetting record is null", async () => {
    (prisma.teamSetting.findUnique as any).mockResolvedValue(null);

    const result = await getDefaultTeamName();
    expect(result).toBe("KwisVrienden");
  });

  it("falls back to 'KwisVrienden' when defaultTeamName is blank or whitespace", async () => {
    (prisma.teamSetting.findUnique as any).mockResolvedValue({
      id: "singleton",
      defaultTeamName: "   ",
    });

    const result = await getDefaultTeamName();
    expect(result).toBe("KwisVrienden");
  });
});
