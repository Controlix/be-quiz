import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { put } from "@vercel/blob";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUploadedFlyer(fileBuffer: Buffer, mimeType: string): Promise<string> {
  const allowedMimes: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  const extension = allowedMimes[mimeType] || ".jpg";
  const filename = `${crypto.randomUUID()}${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${filename}`, fileBuffer, {
      access: "public",
      contentType: mimeType,
    });
    return blob.url;
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(filePath, fileBuffer);

  return `/uploads/${filename}`;
}
