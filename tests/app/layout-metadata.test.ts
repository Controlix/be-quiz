import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/quizService", () => ({
  getConfiguredTeamName: vi.fn(),
}));

import { generateMetadata } from "@/app/layout";
import { getConfiguredTeamName } from "@/services/quizService";

describe("RootLayout generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats title as 'Be-Quiz - <teamname>' when a team name is configured", async () => {
    vi.mocked(getConfiguredTeamName).mockResolvedValue("De Slimste Ploeg");

    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Be-Quiz - De Slimste Ploeg");
    expect(metadata.appleWebApp).toEqual(
      expect.objectContaining({
        title: "Be-Quiz - De Slimste Ploeg",
        capable: true,
      })
    );
  });

  it("defaults title to 'Be-Quiz' when there is no team name configured", async () => {
    vi.mocked(getConfiguredTeamName).mockResolvedValue(null);

    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Be-Quiz");
    expect(metadata.appleWebApp).toEqual(
      expect.objectContaining({
        title: "Be-Quiz",
        capable: true,
      })
    );
  });
});
