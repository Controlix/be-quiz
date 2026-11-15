import fs from "fs";
import path from "path";

export function findNftFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(findNftFiles(full));
    } else if (
      entry.endsWith(".nft.json") &&
      !entry.includes("next-server") &&
      !entry.includes("next-minimal-server")
    ) {
      results.push(full);
    }
  }
  return results;
}

export function analyzeNftFile(nftPath: string): {
  totalBytes: number;
  topPackages: Record<string, number>;
  rawFiles: string[];
} {
  const dir = path.dirname(nftPath);
  const data = JSON.parse(fs.readFileSync(nftPath, "utf8")) as { files: string[] };
  let totalBytes = 0;
  const topPackages: Record<string, number> = {};

  for (const f of data.files) {
    const absPath = path.resolve(dir, f);
    try {
      const stat = fs.statSync(absPath);
      if (stat.isFile()) {
        totalBytes += stat.size;
        // Group by scoped package (@prisma/client, @swc/core) or standard package
        const match = absPath.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
        const pkg = match ? match[1] : "(app)";
        topPackages[pkg] = (topPackages[pkg] || 0) + stat.size;
      }
    } catch {}
  }

  return { totalBytes, topPackages, rawFiles: data.files };
}

export function validateAcceptanceCriteria(
  nftFiles: string[],
  distServerDir: string
): { passed: boolean; violations: { route: string; issues: string[] }[] } {
  const isVercel = process.env.VERCEL === "1";
  const maxBytes = 25 * 1024 * 1024; // 25 MB ceiling for Vercel functions
  const violations: { route: string; issues: string[] }[] = [];

  for (const nft of nftFiles) {
    const rel = path
      .relative(distServerDir, nft)
      .replace(".js.nft.json", "")
      .replace(".nft.json", "");
    const { totalBytes, rawFiles } = analyzeNftFile(nft);
    const issues: string[] = [];

    // Zero WASM or base64 wasm compilers across all targets
    const wasmFiles = rawFiles.filter((f) => f.includes(".wasm") || f.includes("wasm-base64"));
    if (wasmFiles.length > 0) {
      issues.push(`Contains ${wasmFiles.length} prohibited WASM/compiler files`);
    }

    // On Vercel target: no musl binaries and enforce 25 MB ceiling
    if (isVercel) {
      const muslFiles = rawFiles.filter((f) => f.includes("libquery_engine-linux-musl"));
      if (muslFiles.length > 0) {
        issues.push(`Contains ${muslFiles.length} prohibited Alpine linux-musl query engine files`);
      }

      if (totalBytes > maxBytes) {
        issues.push(
          `Exceeds 25 MB ceiling (${(totalBytes / (1024 * 1024)).toFixed(2)} MB uncompressed)`
        );
      }
    }

    if (issues.length > 0) {
      violations.push({ route: rel, issues });
    }
  }

  return { passed: violations.length === 0, violations };
}

function main() {
  const distServerDir = ".next/server";
  const nftFiles = findNftFiles(distServerDir);

  if (nftFiles.length === 0) {
    console.error("No .nft.json trace files found. Please run 'npx next build' first.");
    process.exit(1);
  }

  console.log("=== Serverless Bundle Trace Audit ===");
  console.log(`Total Functions Traced: ${nftFiles.length}\n`);
  console.log("Route".padEnd(46) + "Uncompressed".padStart(14) + "   Top Offender");
  console.log("-".repeat(82));

  let grandTotal = 0;
  const rows: { route: string; bytes: number; topStr: string }[] = [];

  for (const nft of nftFiles) {
    const { totalBytes, topPackages } = analyzeNftFile(nft);
    grandTotal += totalBytes;
    const rel = path
      .relative(distServerDir, nft)
      .replace(".js.nft.json", "")
      .replace(".nft.json", "");
    const top = Object.entries(topPackages).sort((a, b) => b[1] - a[1])[0];
    const topStr = top ? `${top[0]} (${(top[1] / (1024 * 1024)).toFixed(1)} MB)` : "-";
    rows.push({ route: rel, bytes: totalBytes, topStr });
  }

  rows.sort((a, b) => b.bytes - a.bytes);
  for (const r of rows) {
    console.log(
      r.route.padEnd(46) +
        `${(r.bytes / (1024 * 1024)).toFixed(2)} MB`.padStart(14) +
        "   " +
        r.topStr
    );
  }

  console.log("-".repeat(82));
  console.log(
    `Grand Total Uncompressed Footprint: ${(grandTotal / (1024 * 1024)).toFixed(2)} MB (~${(grandTotal / (1024 * 1024 * 1024)).toFixed(2)} GB)\n`
  );

  const { passed, violations } = validateAcceptanceCriteria(nftFiles, distServerDir);
  if (!passed) {
    console.error("❌ Bundle Optimization Acceptance Criteria FAILED:");
    for (const v of violations) {
      console.error(`  - ${v.route}:`);
      for (const issue of v.issues) {
        console.error(`      • ${issue}`);
      }
    }
    process.exit(1);
  }

  console.log("✔ All bundle optimization acceptance criteria PASSED.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
