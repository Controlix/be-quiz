import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminUpdateMemberRoleAction } from "@/actions/adminActions";
import * as auth from "@/lib/auth";
import * as memberService from "@/services/memberService";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/auth");
vi.mock("@/services/memberService");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("adminUpdateMemberRoleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);

    const result = await adminUpdateMemberRoleAction("member-1", "ADMIN");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Niet geautoriseerd.");
    expect(memberService.updateMemberRole).not.toHaveBeenCalled();
  });

  it("rejects requests from non-admin users", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({
      id: "user-1",
      role: "USER",
      name: "Regular User",
    } as any);

    const result = await adminUpdateMemberRoleAction("member-2", "ADMIN");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Niet geautoriseerd.");
    expect(memberService.updateMemberRole).not.toHaveBeenCalled();
  });

  it("successfully updates role when called by an admin and revalidates path", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      name: "Admin User",
    } as any);
    vi.spyOn(memberService, "updateMemberRole").mockResolvedValue({
      id: "member-2",
      role: "ADMIN",
      name: "Promoted User",
    } as any);

    const result = await adminUpdateMemberRoleAction("member-2", "ADMIN");
    expect(result.success).toBe(true);
    expect(memberService.updateMemberRole).toHaveBeenCalledWith("member-2", "ADMIN", "admin-1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members");
  });

  it("forwards service errors gracefully", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      name: "Admin User",
    } as any);
    vi.spyOn(memberService, "updateMemberRole").mockRejectedValue(
      new Error("Er moet minstens één beheerder overblijven.")
    );

    const result = await adminUpdateMemberRoleAction("admin-1", "USER");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Er moet minstens één beheerder overblijven.");
  });
});
