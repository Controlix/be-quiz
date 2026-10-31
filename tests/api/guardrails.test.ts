import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as extractPost } from "@/app/api/quizzes/extract/route";
import { GET as calendarGet } from "@/app/api/quizzes/[id]/calendar.ics/route";

describe("Capability Guardrails (HTTP 501)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ENABLE_AI_VISION;
    delete process.env.ENABLE_ICAL_EXPORT;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns 501 for /api/quizzes/extract when ENABLE_AI_VISION is not enabled", async () => {
    const formData = new FormData();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "test.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", file);

    const req = new NextRequest("http://localhost:3000/api/quizzes/extract", {
      method: "POST",
      body: formData,
    });

    const res = await extractPost(req);
    expect(res.status).toBe(501);
    const json = await res.json();
    expect(json.error).toBe("AI vision extraction is disabled in this deployment.");
  });

  it("returns 501 for /api/quizzes/[id]/calendar.ics when ENABLE_ICAL_EXPORT is not enabled", async () => {
    const req = new NextRequest("http://localhost:3000/api/quizzes/quiz-123/calendar.ics");
    const params = Promise.resolve({ id: "quiz-123" });

    const res = await calendarGet(req, { params });
    expect(res.status).toBe(501);
    const json = await res.json();
    expect(json.error).toBe("Calendar iCal export integration is disabled in this deployment.");
  });
});
