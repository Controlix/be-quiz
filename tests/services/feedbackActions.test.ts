import { describe, it, expect, beforeEach } from "vitest";
import { submitFeedbackAction, toggleFeedbackResolvedAction, deleteFeedbackAction } from "@/actions/feedbackActions";
import { prisma } from "@/lib/db";

describe("Feedback Actions", () => {
  let createdId: string | null = null;

  beforeEach(async () => {
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

  it("toggles resolved status and deletes feedback", async () => {
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
