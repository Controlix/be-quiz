import { describe, it, expect } from "vitest";
import { categorizeQuizForTabs } from "../../src/components/TimelineTabs";

describe("Timeline Tab Classification", () => {
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 86400000);

  it("classifies upcoming unregistered as In Beraad", () => {
    expect(categorizeQuizForTabs({ startsAt: future, status: "OPEN", team: { registeredAt: null } })).toBe("IN_BERAAD");
  });

  it("classifies upcoming registered as Gepland", () => {
    expect(categorizeQuizForTabs({ startsAt: future, status: "OPEN", team: { registeredAt: new Date() } })).toBe("GEPLAND");
  });

  it("classifies past or cancelled as Archief", () => {
    expect(categorizeQuizForTabs({ startsAt: past, status: "OPEN", team: { registeredAt: new Date() } })).toBe("ARCHIEF");
    expect(categorizeQuizForTabs({ startsAt: future, status: "CANCELLED", team: { registeredAt: null } })).toBe("ARCHIEF");
  });
});
