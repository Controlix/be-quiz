import path from "path";
import { fileURLToPath } from "url";
import { pruneOrphanedUploads, PruneSummary } from "../src/lib/storagePruner";

export function parsePruneCliArgs(argv: string[]): { dryRun: boolean; force: boolean } {
  const args = new Set(argv);
  return {
    dryRun: args.has("--dry-run"),
    force: args.has("--force"),
  };
}

export async function runPruneCli(argv: string[] = process.argv.slice(2)): Promise<PruneSummary> {
  const { dryRun, force } = parsePruneCliArgs(argv);

  console.log("Starting uploads cleanup...");
  if (dryRun) {
    console.log("[DRY-RUN] Simulating prune: no files will be deleted.");
  }
  if (force) {
    console.log("[FORCE] Bypassing 24-hour TTL check: all unreferenced files will be pruned.");
  }

  const summary = await pruneOrphanedUploads({ dryRun, force });

  console.log("\nCleanup Summary:");
  console.log(`- Storage mode:     ${summary.mode.toUpperCase()}`);
  console.log(`- Files examined:   ${summary.examined}`);
  console.log(`- Referenced in DB: ${summary.referenced}`);
  console.log(
    dryRun ? `- Would delete:     ${summary.deleted}` : `- Files deleted:    ${summary.deleted}`
  );
  console.log(
    `- Space reclaimed:  ${(summary.reclaimedBytes / 1024).toFixed(1)} KB (~${(
      summary.reclaimedBytes /
      (1024 * 1024)
    ).toFixed(2)} MB)`
  );
  console.log(`- Duration:         ${summary.durationMs} ms\n`);

  return summary;
}

const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runPruneCli().catch((err) => {
    console.error("Prune error:", err);
    process.exit(1);
  });
}
