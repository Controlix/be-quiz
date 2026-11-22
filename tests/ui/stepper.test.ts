import { describe, it, expect } from "vitest";
import { updateTeamCapacity } from "../../src/services/rsvpService";

describe("Team Size Capacity Bounds", () => {
  it("rejects team size less than 1 or greater than 10 with specific error message", async () => {
    await expect(updateTeamCapacity("any-id", 0)).rejects.toThrow(
      "Ploeggrootte moet tussen 1 en 10 liggen"
    );
    await expect(updateTeamCapacity("any-id", 11)).rejects.toThrow(
      "Ploeggrootte moet tussen 1 en 10 liggen"
    );
  });
});
