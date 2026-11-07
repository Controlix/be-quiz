import fs from "fs/promises";
import path from "path";
import { prisma as defaultPrisma } from "@/lib/db";
import { list, del } from "@vercel/blob";

export interface PruneSummary {
  examined: number;
  referenced: number;
  deleted: number;
  reclaimedBytes: number;
  durationMs: number;
  mode: "local" | "blob";
}

export interface PruneOptions {
  dryRun?: boolean;
  force?: boolean;
  ttlMs?: number;
  prismaClient?: any;
  now?: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function extractStorageKey(urlOrPath: string): string | null {
  if (!urlOrPath || typeof urlOrPath !== "string") {
    return null;
  }

  // Handle local relative path (e.g., /uploads/flyer.jpg or uploads/flyer.jpg)
  if (urlOrPath.startsWith("/uploads/")) {
    return urlOrPath.slice(1);
  }
  if (urlOrPath.startsWith("uploads/")) {
    return urlOrPath;
  }

  // Handle absolute URLs (e.g., Vercel Blob URLs or external URLs)
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const parsed = new URL(urlOrPath);
      if (parsed.pathname.startsWith("/uploads/")) {
        return parsed.pathname.slice(1);
      }
      if (parsed.pathname.startsWith("uploads/")) {
        return parsed.pathname;
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function getReferencedStorageKeys(prismaClient?: any): Promise<Set<string>> {
  const db = prismaClient ?? defaultPrisma;

  const [quizzes, feedback] = await Promise.all([
    db.quiz.findMany({
      where: { flyerImageUrl: { not: null } },
      select: { flyerImageUrl: true },
    }),
    db.feedback.findMany({
      where: { screenshot: { not: null } },
      select: { screenshot: true },
    }),
  ]);

  const protectedKeys = new Set<string>();

  for (const q of quizzes) {
    if (q.flyerImageUrl) {
      const key = extractStorageKey(q.flyerImageUrl);
      if (key) {
        protectedKeys.add(key);
      }
    }
  }

  for (const f of feedback) {
    if (f.screenshot) {
      const key = extractStorageKey(f.screenshot);
      if (key) {
        protectedKeys.add(key);
      }
    }
  }

  return protectedKeys;
}

export async function pruneOrphanedUploads(options: PruneOptions = {}): Promise<PruneSummary> {
  const startTime = Date.now();
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const now = options.now ?? Date.now();
  const ttlMs = force ? 0 : (options.ttlMs ?? DEFAULT_TTL_MS);

  const isBlobMode = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const mode: "local" | "blob" = isBlobMode ? "blob" : "local";

  const protectedKeys = await getReferencedStorageKeys(options.prismaClient);

  let examined = 0;
  let referenced = 0;
  let deleted = 0;
  let reclaimedBytes = 0;

  if (isBlobMode) {
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const response: Awaited<ReturnType<typeof list>> = await list({
        prefix: "uploads/",
        cursor,
      });

      for (const blob of response.blobs) {
        examined++;
        const key = extractStorageKey(blob.url) ?? blob.pathname;

        if (protectedKeys.has(key)) {
          referenced++;
          continue;
        }

        const uploadedAtMs = new Date(blob.uploadedAt).getTime();
        const ageMs = now - uploadedAtMs;

        if (ageMs < ttlMs) {
          // File is younger than safe retention window
          continue;
        }

        deleted++;
        reclaimedBytes += blob.size;

        if (!dryRun) {
          await del(blob.url);
        }
      }

      hasMore = Boolean(response.hasMore);
      cursor = response.hasMore ? response.cursor : undefined;
    }
  } else {
    const rootUploadsDir = path.join(process.cwd(), "public", "uploads");

    async function scanDirectory(currentDir: string, relativePrefix: string): Promise<void> {
      let entries: any[] = [];
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (err: any) {
        if (err.code === "ENOENT") {
          return;
        }
        throw err;
      }

      for (const entry of entries) {
        if (entry.name.startsWith(".")) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relativeKey = path.posix.join(relativePrefix, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeKey);
        } else if (entry.isFile()) {
          examined++;

          if (protectedKeys.has(relativeKey)) {
            referenced++;
            continue;
          }

          const stat = await fs.stat(fullPath);
          const ageMs = now - stat.mtimeMs;

          if (ageMs < ttlMs) {
            // File is younger than safe retention window
            continue;
          }

          deleted++;
          reclaimedBytes += stat.size;

          if (!dryRun) {
            await fs.unlink(fullPath);
          }
        }
      }
    }

    await scanDirectory(rootUploadsDir, "uploads");
  }

  return {
    examined,
    referenced,
    deleted,
    reclaimedBytes,
    durationMs: Date.now() - startTime,
    mode,
  };
}
