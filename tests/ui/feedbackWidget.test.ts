import { describe, it, expect } from "vitest";
import fs from "fs";

describe("FeedbackWidget UI Component", () => {
  it("exports FeedbackWidget component", async () => {
    const mod = await import("@/components/FeedbackWidget");
    expect(mod.FeedbackWidget).toBeDefined();
  });

  it("dynamically imports html2canvas and handles feedback submission", () => {
    const file = fs.readFileSync("src/components/FeedbackWidget.tsx", "utf-8");
    expect(file).toContain("html2canvas");
    expect(file).toContain("submitFeedbackAction");
    expect(file).toContain("Meld feedback of een bug");
    expect(file).toContain("Bedankt voor je feedback!");
  });

  it("mounts FeedbackWidget in the root layout", () => {
    const layout = fs.readFileSync("src/app/layout.tsx", "utf-8");
    expect(layout).toContain("<FeedbackWidget");
  });
});
