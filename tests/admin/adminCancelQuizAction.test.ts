import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminCancelQuizAction } from "@/actions/adminActions";
import * as auth from "@/lib/auth";
import * as quizService from "@/services/quizService";

vi.mock("@/lib/auth");
vi.mock("@/services/quizService");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("adminCancelQuizAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized non-admin requests", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({ id: "user-1", role: "USER", name: "User" } as any);

    const result = await adminCancelQuizAction("quiz-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Niet geautoriseerd.");
    expect(quizService.cancelQuiz).not.toHaveBeenCalled();
  });

  it("allows admin to cancel quiz and delegates to cancelQuiz service", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue({ id: "admin-1", role: "ADMIN", name: "Admin" } as any);
    vi.spyOn(quizService, "cancelQuiz").mockResolvedValue({ id: "quiz-1", status: "CANCELLED" } as any);

    const result = await adminCancelQuizAction("quiz-1");
    expect(result.success).toBe(true);
    expect(quizService.cancelQuiz).toHaveBeenCalledWith("quiz-1");
  });
});
