import { describe, it, expect } from "vitest";
import { formatReserveBadge, partitionLineup } from "../../src/components/TeamLineup";

describe("Team Lineup Rendering & Partitioning", () => {
  it("formats reserve queue badges correctly", () => {
    expect(formatReserveBadge(0)).toBe("Reserve #1");
    expect(formatReserveBadge(1)).toBe("Reserve #2");
  });

  it("partitions attendees strictly into active and reserves by maxTeamSize", () => {
    const attendees = [
      { id: "1", name: "Marc", queuedSince: new Date(1000) },
      { id: "2", name: "Sarah", queuedSince: new Date(2000) },
      { id: "3", name: "Tom", queuedSince: new Date(3000) },
      { id: "4", name: "Elena", queuedSince: new Date(4000) },
      { id: "5", name: "Thomas", queuedSince: new Date(5000) },
    ];
    const { active, reserves } = partitionLineup(attendees, 4);
    expect(active.length).toBe(4);
    expect(reserves.length).toBe(1);
    expect(reserves[0].name).toBe("Thomas");
  });
});
