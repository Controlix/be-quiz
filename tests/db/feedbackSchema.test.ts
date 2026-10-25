import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { saveUploadedFeedbackImage, deleteFeedbackImage } from "@/lib/feedbackStorage";
import fs from "fs/promises";
import path from "path";

describe("Feedback Schema & Storage", () => {
  it("creates a feedback record with category, url and message", async () => {
    const feedback = await (prisma as any).feedback.create({
      data: {
        category: "BUG",
        message: "Test error remark",
        pageUrl: "/quizzes",
        userAgent: "Vitest Test Runner",
      },
    });

    expect(feedback.id).toBeDefined();
    expect(feedback.category).toBe("BUG");
    expect(feedback.isResolved).toBe(false);

    // Cleanup
    await (prisma as any).feedback.delete({ where: { id: feedback.id } });
  });

  it("saves and deletes feedback image from public uploads directory", async () => {
    const dummyBuffer = Buffer.from("fake-image-bytes");
    const uploadedUrl = await saveUploadedFeedbackImage(dummyBuffer, "image/jpeg");
    expect(uploadedUrl).toMatch(/^\/uploads\/feedback\/[a-f0-9-]+\.jpg$/);

    const fullDiskPath = path.join(process.cwd(), "public", uploadedUrl);
    const fileExistsBefore = await fs.access(fullDiskPath).then(() => true).catch(() => false);
    expect(fileExistsBefore).toBe(true);

    await deleteFeedbackImage(uploadedUrl);
    const fileExistsAfter = await fs.access(fullDiskPath).then(() => true).catch(() => false);
    expect(fileExistsAfter).toBe(false);
  });
});
