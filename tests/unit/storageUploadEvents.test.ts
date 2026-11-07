import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import { domainEvents } from "@/lib/events";
import { saveUploadedFlyer } from "@/lib/storage";
import { saveUploadedFeedbackImage } from "@/lib/feedbackStorage";

describe("Storage Upload Events", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    domainEvents.clear();
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined as any);
    vi.spyOn(fs, "writeFile").mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    domainEvents.clear();
  });

  it("emits asset.uploaded with category flyer when saveUploadedFlyer succeeds", async () => {
    const received: any[] = [];
    domainEvents.subscribe("asset.uploaded", (event) => {
      received.push(event);
    });

    const buffer = Buffer.from("fake-flyer-content");
    const resultUrl = await saveUploadedFlyer(buffer, "image/jpeg");

    expect(received).toHaveLength(1);
    expect(received[0].category).toBe("flyer");
    expect(received[0].url).toBe(resultUrl);
    expect(received[0].occurredAt).toBeInstanceOf(Date);
  });

  it("emits asset.uploaded with category feedback when saveUploadedFeedbackImage succeeds", async () => {
    const received: any[] = [];
    domainEvents.subscribe("asset.uploaded", (event) => {
      received.push(event);
    });

    const buffer = Buffer.from("fake-feedback-content");
    const resultUrl = await saveUploadedFeedbackImage(buffer, "image/png");

    expect(received).toHaveLength(1);
    expect(received[0].category).toBe("feedback");
    expect(received[0].url).toBe(resultUrl);
    expect(received[0].occurredAt).toBeInstanceOf(Date);
  });
});
