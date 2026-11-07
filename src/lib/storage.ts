import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { domainEvents } from "@/lib/events";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUploadedFlyer(fileBuffer: Buffer, mimeType: string): Promise<string> {
  const allowedMimes: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  const extension = allowedMimes[mimeType] || ".jpg";
  const filename = `${crypto.randomUUID()}${extension}`;

  let flyerUrl: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${filename}`, fileBuffer, {
      access: "public",
      contentType: mimeType,
    });
    flyerUrl = blob.url;
  } else {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const filePath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(filePath, fileBuffer);
    flyerUrl = `/uploads/${filename}`;
  }

  domainEvents.emit({
    type: "asset.uploaded",
    url: flyerUrl,
    category: "flyer",
    occurredAt: new Date(),
  });

  return flyerUrl;
}
