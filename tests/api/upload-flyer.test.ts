import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/quizzes/upload-flyer/route";
import * as storage from "@/lib/storage";

describe("POST /api/quizzes/upload-flyer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when no file is uploaded", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost:3000/api/quizzes/upload-flyer", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("saves the uploaded flyer and returns flyerImageUrl", async () => {
    vi.spyOn(storage, "saveUploadedFlyer").mockResolvedValue("/uploads/test-flyer.jpg");

    const formData = new FormData();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "test.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", file);

    const req = new NextRequest("http://localhost:3000/api/quizzes/upload-flyer", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.flyerImageUrl).toBe("/uploads/test-flyer.jpg");
  });
});
