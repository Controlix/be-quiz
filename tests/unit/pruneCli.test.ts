import { describe, it, expect, vi, beforeEach } from "vitest";
import * as storagePruner from "@/lib/storagePruner";
import { parsePruneCliArgs, runPruneCli } from "../../scripts/prune-uploads";

describe("pruneCli", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("parsePruneCliArgs", () => {
    it("parses defaults when no flags provided", () => {
      const parsed = parsePruneCliArgs([]);
      expect(parsed.dryRun).toBe(false);
      expect(parsed.force).toBe(false);
    });

    it("parses --dry-run flag", () => {
      const parsed = parsePruneCliArgs(["--dry-run"]);
      expect(parsed.dryRun).toBe(true);
      expect(parsed.force).toBe(false);
    });

    it("parses --force flag", () => {
      const parsed = parsePruneCliArgs(["--force"]);
      expect(parsed.dryRun).toBe(false);
      expect(parsed.force).toBe(true);
    });

    it("parses both --dry-run and --force flags", () => {
      const parsed = parsePruneCliArgs(["--dry-run", "--force"]);
      expect(parsed.dryRun).toBe(true);
      expect(parsed.force).toBe(true);
    });
  });

  describe("runPruneCli", () => {
    it("calls pruneOrphanedUploads with parsed CLI args and logs summary", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const pruneSpy = vi.spyOn(storagePruner, "pruneOrphanedUploads").mockResolvedValue({
        examined: 5,
        referenced: 2,
        deleted: 3,
        reclaimedBytes: 15360, // 15 KB
        durationMs: 42,
        mode: "local",
      });

      const summary = await runPruneCli(["--dry-run"]);

      expect(pruneSpy).toHaveBeenCalledWith({ dryRun: true, force: false });
      expect(summary.deleted).toBe(3);
      expect(logSpy).toHaveBeenCalled();
    });
  });
});
