import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminOverrideAttendAction } from "../../src/actions/adminActions";
import * as auth from "../../src/lib/auth";
import * as rsvpService from "../../src/services/rsvpService";

vi.mock("../../src/lib/auth");
vi.mock("../../src/services/rsvpService");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("adminOverrideAttendAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Review Focus #4: Non-admin authorization rejection
  it("rejects unauthorized non-admin requests", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({ id: "user-1", role: "USER", name: "User" } as any);

    const result = await adminOverrideAttendAction("team-1", "member-1", "user-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Niet geautoriseerd.");
    expect(rsvpService.adminOverrideAttend).not.toHaveBeenCalled();
  });

  it("allows admin to re-enroll a player", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({ id: "admin-1", role: "ADMIN", name: "Admin" } as any);
    vi.spyOn(rsvpService, "adminOverrideAttend").mockResolvedValue(undefined as any);

    const result = await adminOverrideAttendAction("team-1", "member-1", "admin-1");
    expect(result.success).toBe(true);
    expect(rsvpService.adminOverrideAttend).toHaveBeenCalledWith("team-1", "member-1", "admin-1");
  });
});
