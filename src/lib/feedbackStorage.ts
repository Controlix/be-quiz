import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { put, del } from "@vercel/blob";

const FEEDBACK_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "feedback");

export async function saveUploadedFeedbackImage(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const allowedMimes: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  const extension = allowedMimes[mimeType] || ".jpg";
  const filename = `${crypto.randomUUID()}${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/feedback/${filename}`, fileBuffer, {
      access: "public",
      contentType: mimeType,
    });
    return blob.url;
  }

  await fs.mkdir(FEEDBACK_UPLOADS_DIR, { recursive: true });
  const filePath = path.join(FEEDBACK_UPLOADS_DIR, filename);
  await fs.writeFile(filePath, fileBuffer);

  return `/uploads/feedback/${filename}`;
}

export async function deleteFeedbackImage(relativeUrl: string): Promise<void> {
  if (!relativeUrl) {
    return;
  }

  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(relativeUrl);
      } catch (err: any) {
        console.warn("Could not delete feedback image from blob:", err);
      }
    }
    return;
  }

  if (!relativeUrl.startsWith("/uploads/feedback/")) {
    return;
  }

  // Strip leading slash and join with public directory
  const filePath = path.join(process.cwd(), "public", relativeUrl);
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.warn("Could not delete feedback image:", err);
    }
  }
}
