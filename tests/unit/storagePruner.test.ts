import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs/promises";
import * as vercelBlob from "@vercel/blob";
import {
  extractStorageKey,
  getReferencedStorageKeys,
  pruneOrphanedUploads,
} from "@/lib/storagePruner";

vi.mock("@vercel/blob", () => ({
  list: vi.fn(),
  del: vi.fn(),
}));

describe("storagePruner", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("extractStorageKey", () => {
    it("extracts key from relative local flyer path", () => {
      expect(extractStorageKey("/uploads/flyer-1.jpg")).toBe("uploads/flyer-1.jpg");
    });

    it("extracts key from relative local feedback path", () => {
      expect(extractStorageKey("/uploads/feedback/screen-1.png")).toBe(
        "uploads/feedback/screen-1.png"
      );
    });

    it("extracts key from Vercel Blob URL with uploads prefix", () => {
      expect(
        extractStorageKey("https://abc123xyz.public.blob.vercel-storage.com/uploads/flyer-2.jpg")
      ).toBe("uploads/flyer-2.jpg");
      expect(
        extractStorageKey(
          "https://abc123xyz.public.blob.vercel-storage.com/uploads/feedback/screen-2.png"
        )
      ).toBe("uploads/feedback/screen-2.png");
    });

    it("returns null for external non-storage URLs", () => {
      expect(extractStorageKey("https://images.unsplash.com/photo-12345")).toBeNull();
      expect(extractStorageKey("https://example.com/logo.png")).toBeNull();
      expect(extractStorageKey("")).toBeNull();
    });
  });

  describe("getReferencedStorageKeys", () => {
    it("queries quizzes and feedback and returns unique normalized storage keys", async () => {
      const mockPrisma = {
        quiz: {
          findMany: vi.fn().mockResolvedValue([
            { flyerImageUrl: "/uploads/quiz-flyer.jpg" },
            {
              flyerImageUrl: "https://abc.public.blob.vercel-storage.com/uploads/blob-flyer.png",
            },
            { flyerImageUrl: "https://external.com/pic.jpg" },
            { flyerImageUrl: null },
          ]),
        },
        feedback: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { screenshot: "/uploads/feedback/screen.jpg" },
              { screenshot: null },
            ]),
        },
      };

      const keys = await getReferencedStorageKeys(mockPrisma as any);
      expect(keys.has("uploads/quiz-flyer.jpg")).toBe(true);
      expect(keys.has("uploads/blob-flyer.png")).toBe(true);
      expect(keys.has("uploads/feedback/screen.jpg")).toBe(true);
      expect(keys.size).toBe(3);
    });
  });

  describe("pruneOrphanedUploads (Local Mode)", () => {
    it("deletes unreferenced files older than 24 hours, but preserves young files and referenced files", async () => {
      const now = 100_000_000;
      const olderThan24h = now - 25 * 60 * 60 * 1000;
      const youngerThan24h = now - 2 * 60 * 60 * 1000;

      const mockPrisma = {
        quiz: {
          findMany: vi.fn().mockResolvedValue([{ flyerImageUrl: "/uploads/referenced.jpg" }]),
        },
        feedback: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      // Mock fs.readdir
      vi.spyOn(fs, "readdir").mockImplementation(async (dirPath) => {
        const str = String(dirPath);
        if (str.endsWith(path.join("public", "uploads"))) {
          return [
            { name: "referenced.jpg", isFile: () => true, isDirectory: () => false },
            { name: "old-orphan.jpg", isFile: () => true, isDirectory: () => false },
            { name: "young-orphan.jpg", isFile: () => true, isDirectory: () => false },
            { name: "feedback", isFile: () => false, isDirectory: () => true },
          ] as any;
        }
        if (str.endsWith(path.join("public", "uploads", "feedback"))) {
          return [
            { name: "old-feedback-orphan.png", isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        return [] as any;
      });

      // Mock fs.stat
      vi.spyOn(fs, "stat").mockImplementation(async (filePath) => {
        const str = String(filePath);
        if (str.includes("referenced.jpg")) {
          return { mtimeMs: olderThan24h, size: 5000 } as any;
        }
        if (str.includes("old-orphan.jpg")) {
          return { mtimeMs: olderThan24h, size: 10000 } as any;
        }
        if (str.includes("young-orphan.jpg")) {
          return { mtimeMs: youngerThan24h, size: 8000 } as any;
        }
        if (str.includes("old-feedback-orphan.png")) {
          return { mtimeMs: olderThan24h, size: 12000 } as any;
        }
        return { mtimeMs: now, size: 0 } as any;
      });

      const unlinkSpy = vi.spyOn(fs, "unlink").mockResolvedValue(undefined);

      const summary = await pruneOrphanedUploads({
        dryRun: false,
        now,
        prismaClient: mockPrisma as any,
      });

      expect(summary.mode).toBe("local");
      expect(summary.examined).toBe(4); // 3 root files + 1 feedback file
      expect(summary.referenced).toBe(1);
      expect(summary.deleted).toBe(2); // old-orphan.jpg and old-feedback-orphan.png
      expect(summary.reclaimedBytes).toBe(22000);
      expect(unlinkSpy).toHaveBeenCalledTimes(2);
    });

    it("does not unlink files when dryRun is true", async () => {
      const now = 100_000_000;
      const olderThan24h = now - 25 * 60 * 60 * 1000;

      const mockPrisma = {
        quiz: { findMany: vi.fn().mockResolvedValue([]) },
        feedback: { findMany: vi.fn().mockResolvedValue([]) },
      };

      vi.spyOn(fs, "readdir").mockImplementation(async (dirPath) => {
        const str = String(dirPath);
        if (str.endsWith(path.join("public", "uploads"))) {
          return [{ name: "old-orphan.jpg", isFile: () => true, isDirectory: () => false }] as any;
        }
        return [] as any;
      });

      vi.spyOn(fs, "stat").mockResolvedValue({ mtimeMs: olderThan24h, size: 10000 } as any);
      const unlinkSpy = vi.spyOn(fs, "unlink").mockResolvedValue(undefined);

      const summary = await pruneOrphanedUploads({
        dryRun: true,
        now,
        prismaClient: mockPrisma as any,
      });

      expect(summary.deleted).toBe(1);
      expect(summary.reclaimedBytes).toBe(10000);
      expect(unlinkSpy).not.toHaveBeenCalled();
    });

    it("deletes young unreferenced files when force is true", async () => {
      const now = 100_000_000;
      const youngerThan24h = now - 1 * 60 * 60 * 1000;

      const mockPrisma = {
        quiz: { findMany: vi.fn().mockResolvedValue([]) },
        feedback: { findMany: vi.fn().mockResolvedValue([]) },
      };

      vi.spyOn(fs, "readdir").mockImplementation(async (dirPath) => {
        const str = String(dirPath);
        if (str.endsWith(path.join("public", "uploads"))) {
          return [
            { name: "young-orphan.jpg", isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        return [] as any;
      });

      vi.spyOn(fs, "stat").mockResolvedValue({ mtimeMs: youngerThan24h, size: 4000 } as any);
      const unlinkSpy = vi.spyOn(fs, "unlink").mockResolvedValue(undefined);

      const summary = await pruneOrphanedUploads({
        force: true,
        now,
        prismaClient: mockPrisma as any,
      });

      expect(summary.deleted).toBe(1);
      expect(summary.reclaimedBytes).toBe(4000);
      expect(unlinkSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("pruneOrphanedUploads (Blob Mode)", () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = "blob-token-test";
    });

    it("paginates and deletes unreferenced blobs older than 24 hours", async () => {
      const now = 200_000_000;
      const olderThan24h = new Date(now - 30 * 60 * 60 * 1000);
      const youngerThan24h = new Date(now - 1 * 60 * 60 * 1000);

      const mockPrisma = {
        quiz: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { flyerImageUrl: "https://blob.vercel-storage.com/uploads/active.jpg" },
            ]),
        },
        feedback: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const listMock = vi.mocked(vercelBlob.list);
      const delMock = vi.mocked(vercelBlob.del);

      listMock
        .mockResolvedValueOnce({
          hasMore: true,
          cursor: "cursor-page-2",
          blobs: [
            {
              url: "https://blob.vercel-storage.com/uploads/active.jpg",
              pathname: "uploads/active.jpg",
              size: 5000,
              uploadedAt: olderThan24h,
            },
            {
              url: "https://blob.vercel-storage.com/uploads/young-orphan.jpg",
              pathname: "uploads/young-orphan.jpg",
              size: 8000,
              uploadedAt: youngerThan24h,
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          hasMore: false,
          cursor: undefined,
          blobs: [
            {
              url: "https://blob.vercel-storage.com/uploads/old-orphan.jpg",
              pathname: "uploads/old-orphan.jpg",
              size: 15000,
              uploadedAt: olderThan24h,
            },
          ],
        } as any);

      delMock.mockResolvedValue(undefined);

      const summary = await pruneOrphanedUploads({
        dryRun: false,
        now,
        prismaClient: mockPrisma as any,
      });

      expect(summary.mode).toBe("blob");
      expect(summary.examined).toBe(3);
      expect(summary.referenced).toBe(1);
      expect(summary.deleted).toBe(1); // only old-orphan.jpg
      expect(summary.reclaimedBytes).toBe(15000);
      expect(delMock).toHaveBeenCalledTimes(1);
      expect(delMock).toHaveBeenCalledWith(
        "https://blob.vercel-storage.com/uploads/old-orphan.jpg"
      );
    });
  });
});
