import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Admin Feedback Management Back-Office", () => {
  it("exports AdminFeedbackClient component", async () => {
    const mod = await import("@/components/AdminFeedbackClient");
    expect(mod.AdminFeedbackClient).toBeDefined();
  });

  it("checks admin auth and loads feedbacks with member relations in /admin/feedback/page.tsx", () => {
    const file = fs.readFileSync("src/app/admin/feedback/page.tsx", "utf-8");
    expect(file).toContain("getSessionMember");
    expect(file).toContain('role !== "ADMIN"');
    expect(file).toContain("prisma.feedback.findMany");
    expect(file).toContain("AdminFeedbackClient");
  });

  it("implements filtering, screenshot preview, and resolve/delete action controls in AdminFeedbackClient", () => {
    const file = fs.readFileSync("src/components/AdminFeedbackClient.tsx", "utf-8");
    expect(file).toContain("toggleFeedbackResolvedAction");
    expect(file).toContain("deleteFeedbackAction");
    expect(file).toContain("Openstaand");
    expect(file).toContain("Opgelost");
    expect(file).toContain("Screenshot bekijken");
  });
});
