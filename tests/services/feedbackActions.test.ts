import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";

// Mock getSessionMember
let mockSessionMember: any = null;
vi.mock("@/lib/auth", () => ({
  getSessionMember: vi.fn(async () => mockSessionMember),
}));

// Import actions after mock
import { submitFeedbackAction, toggleFeedbackResolvedAction, deleteFeedbackAction } from "@/actions/feedbackActions";

describe("Feedback Actions", () => {
  let createdId: string | null = null;

  beforeEach(async () => {
    mockSessionMember = null;
    if (createdId) {
      await prisma.feedback.deleteMany({ where: { id: createdId } });
      createdId = null;
    }
  });

  it("rejects feedback with message shorter than 3 characters", async () => {
    const formData = new FormData();
    formData.append("message", "hi");
    formData.append("category", "BUG");
    formData.append("pageUrl", "/quizzes");

    const result = await submitFeedbackAction(formData);
    expect(result.success).toBe(false);
    expect(result.error).toContain("te kort");
  });

  it("submits valid feedback and stores it in the database", async () => {
    const formData = new FormData();
    formData.append("message", "Knop werkt niet goed op mobile");
    formData.append("category", "BUG");
    formData.append("pageUrl", "/quizzes/new");
    formData.append("userAgent", "TestBrowser 1.0");

    const result = await submitFeedbackAction(formData);
    expect(result.success).toBe(true);
    expect(result.feedbackId).toBeDefined();
    createdId = result.feedbackId!;

    const item = await prisma.feedback.findUnique({ where: { id: createdId! } });
    expect(item?.message).toBe("Knop werkt niet goed op mobile");
    expect(item?.category).toBe("BUG");
    expect(item?.isResolved).toBe(false);
  });

  it("blocks unauthenticated or non-admin users from toggling resolved or deleting feedback", async () => {
    const item = await prisma.feedback.create({
      data: {
        category: "BUG",
        message: "Auth check test item",
        pageUrl: "/quizzes",
      },
    });
    createdId = item.id;

    // 1. Unauthenticated (mockSessionMember = null)
    mockSessionMember = null;
    const unauthToggle = await toggleFeedbackResolvedAction(item.id);
    expect(unauthToggle.success).toBe(false);
    expect(unauthToggle.error).toBe("Niet geautoriseerd.");

    const unauthDelete = await deleteFeedbackAction(item.id);
    expect(unauthDelete.success).toBe(false);
    expect(unauthDelete.error).toBe("Niet geautoriseerd.");

    // 2. Regular user (role = USER)
    mockSessionMember = { id: "user-1", name: "User", role: "USER" };
    const userToggle = await toggleFeedbackResolvedAction(item.id);
    expect(userToggle.success).toBe(false);
    expect(userToggle.error).toBe("Niet geautoriseerd.");

    const userDelete = await deleteFeedbackAction(item.id);
    expect(userDelete.success).toBe(false);
    expect(userDelete.error).toBe("Niet geautoriseerd.");
  });

  it("allows admin to toggle resolved status and delete feedback", async () => {
    mockSessionMember = { id: "admin-1", name: "Marc", role: "ADMIN" };

    const item = await prisma.feedback.create({
      data: {
        category: "IDEA",
        message: "Een donkere modus zou cool zijn",
        pageUrl: "/quizzes",
      },
    });
    createdId = item.id;

    // Toggle resolved
    const toggleRes = await toggleFeedbackResolvedAction(item.id);
    expect(toggleRes.success).toBe(true);
    expect(toggleRes.isResolved).toBe(true);

    // Delete
    const deleteRes = await deleteFeedbackAction(item.id);
    expect(deleteRes.success).toBe(true);

    const check = await prisma.feedback.findUnique({ where: { id: item.id } });
    expect(check).toBeNull();
    createdId = null;
  });
});
