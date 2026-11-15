# Vercel Functions Storage & Serverless Bundle Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Next.js Serverless Function bundle sizes and Vercel Functions Storage consumption by excluding unnecessary build artifacts, unused Prisma WASM engines, and cross-platform native binaries from output file traces.

**Architecture:** Leverage Next.js 16's native `outputFileTracingExcludes` and `serverExternalPackages` in `next.config.ts` to prune redundant engine and compiler dependencies from `.nft.json` trace manifests across all 17 page and API routes. Maintain dual-target compatibility so Docker standalone Alpine builds retain `linux-musl` while Vercel builds shed ~75–77 MB uncompressed (~25–30 MB compressed) per database route (~55–60 MB uncompressed in local/Docker builds).

**Tech Stack:** Next.js 16.4.3, Prisma 6.19.3, Node.js 24, Vitest 5.0.5.

**Spec:** `docs/superpowers/specs/2026-11-15-vercel-storage-optimization-design.md`

## Global Constraints

- **Next.js 16 Configuration Schema:** Must use `outputFileTracingExcludes` and `serverExternalPackages` conforming to Next.js 16 API.
- **Dual Target Stability:** Must not break local Docker standalone builds (`output: "standalone"`) running on Alpine Linux (`linux-musl`).
- **Zero API Contract Alteration:** API route signatures, URLs, and OpenAPI specs must remain 100% untouched.
- **Zero Allowlist Drift:** Security scan (`audit-ci.json`) must remain clean with zero new exemptions.
- **Check All Green:** `npm run check:all` must pass with zero errors.
- **Explicit Consent for Git Commits:** Per repository instructions (`AGENTS.md`), never commit without explicit human approval.

## Review Focus

1. **Docker standalone breakage:** If `linux-musl` engine is excluded unconditionally, Alpine Docker containers crash with missing query engine binary. (Guard with `process.env.VERCEL === "1"` check).
2. **Missing PostgreSQL engine at runtime:** If the active engine (`debian-openssl-3.0.x` / `native`) is accidentally matched by exclusion globs, Lambda functions throw `PrismaClientInitializationError`.
3. **Prisma WASM compiler leak:** If `query_compiler_bg.*` or `.prisma/client/*.wasm` are omitted from exclusion globs, ~27 MB of dead WASM code persists in every route trace.
4. **Middleware import leakage:** If a future commit imports `@/lib/db` or `auth.ts` into `proxy.ts`, middleware inflates back to 42 MB.
5. **Glob pattern mismatch in Next.js tracing:** If globs use unsupported syntax or wrong relative root, Next.js ignores them silently.
6. **Turbo build compatibility:** Ensure exclusions work seamlessly with Turbopack production builds (`next build`).

---

### Task 1: Baseline Trace Audit Tooling & Initial Benchmark Capture

**Files:**

- Create: `scripts/audit-bundle-trace.ts`
- Modify: `package.json` (add `"audit:bundle": "tsx scripts/audit-bundle-trace.ts"`)
- Create: `tests/unit/bundleOptimization.test.ts`

**Interfaces:**

- Consumes: `.next/server/**/*.nft.json` from production build, `next.config.ts`
- Produces: Baseline footprint report, runnable `"audit:bundle"` command, failing unit tests for optimization config and proxy isolation.

- [x] **Step 1: Create `scripts/audit-bundle-trace.ts`**

Create script that inspects all `.nft.json` files under `.next/server/`, calculates per-route and total uncompressed footprints, and identifies top offending packages:

```ts
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

  return { totalBytes, topPackages };
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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [x] **Step 2: Add `"audit:bundle"` script to `package.json`**

Add script `"audit:bundle": "tsx scripts/audit-bundle-trace.ts"`.

- [x] **Step 3: Run baseline audit to capture unoptimized "Before" benchmark**

Run: `npx next build && npm run audit:bundle`  
Expected:

- Production build completes cleanly.
- Baseline audit records the unoptimized state: ~1.40 GB uncompressed footprint across 19 traced functions, with ~95.7 MB per database route.

- [x] **Step 4: Write failing unit tests for bundle optimization config**

Create `tests/unit/bundleOptimization.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import path from "path";
import fs from "fs";

describe("Next.js Bundle Optimization Configuration", () => {
  it("defines outputFileTracingExcludes for compiler and unused build artifacts", () => {
    expect(nextConfig.outputFileTracingExcludes).toBeDefined();
    const globalExcludes = nextConfig.outputFileTracingExcludes?.["*"] || [];

    // Must exclude heavy compiler/bundler artifacts
    expect(globalExcludes.some((pattern: string) => pattern.includes("@swc/core"))).toBe(true);
    expect(globalExcludes.some((pattern: string) => pattern.includes("@esbuild"))).toBe(true);

    // Must exclude unused Prisma WASM engines and compilers
    expect(globalExcludes.some((pattern: string) => pattern.includes("wasm"))).toBe(true);
  });

  it("preserves linux-musl binary target in local/Docker builds and excludes it on Vercel", () => {
    const globalExcludes = nextConfig.outputFileTracingExcludes?.["*"] || [];
    const hasMuslExclude = globalExcludes.some((pattern: string) => pattern.includes("linux-musl"));

    if (process.env.VERCEL === "1") {
      expect(hasMuslExclude).toBe(true);
    } else {
      // Must NOT exclude musl locally or in Docker Alpine builds
      expect(hasMuslExclude).toBe(false);
    }
  });

  it("verifies proxy.ts does not import database clients or heavy crypto libraries", () => {
    const proxyPath = path.resolve(process.cwd(), "src/proxy.ts");
    const proxyContent = fs.readFileSync(proxyPath, "utf8");
    expect(proxyContent).not.toContain("@/lib/db");
    expect(proxyContent).not.toContain("@prisma/client");
  });
});
```

- [x] **Step 5: Run test to verify it fails**

Run: `npx vitest run tests/unit/bundleOptimization.test.ts`  
Expected: FAIL with `expected undefined to be defined` for `outputFileTracingExcludes`.

- [x] **Step 6: Checkpoint baseline tooling and initial tests (Ask user before committing)**

```bash
git add scripts/audit-bundle-trace.ts package.json tests/unit/bundleOptimization.test.ts
# Prompt user for explicit consent before running git commit:
git commit -m "chore: add bundle trace audit tooling and baseline tests"
```

---

### Task 2: Configure Next.js Output Tracing Excludes & External Packages

**Files:**

- Modify: `next.config.ts`
- Test: `tests/unit/bundleOptimization.test.ts`

**Interfaces:**

- Consumes: `process.env.VERCEL`
- Produces: Optimized `NextConfig` object with pruned trace rules.

- [x] **Step 1: Implement `outputFileTracingExcludes` and `serverExternalPackages` in `next.config.ts`**

Update `next.config.ts`:

```ts
import type { NextConfig } from "next";

const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["tinyx.local", "*.local", "localhost", "192.168.0.248"],
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingExcludes: {
    "*": [
      // Build and bundler artifacts
      "node_modules/@swc/core/**",
      "node_modules/@esbuild/**",
      "node_modules/webpack/**",
      "node_modules/terser/**",
      // Unused Prisma WASM query engines and compilers across all targets
      "node_modules/@prisma/client/runtime/*wasm-base64*",
      "node_modules/@prisma/client/runtime/*.wasm",
      "node_modules/.prisma/client/*.wasm",
      // On Vercel, exclude Alpine/musl binary target (Amazon Linux uses glibc debian-openssl-3.0.x)
      ...(isVercel ? ["node_modules/.prisma/client/libquery_engine-linux-musl*"] : []),
    ],
  },
};

export default nextConfig;
```

- [x] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/bundleOptimization.test.ts`  
Expected: PASS.

- [x] **Step 3: Checkpoint configuration changes (Ask user before committing)**

```bash
git add next.config.ts
# Prompt user for explicit consent before running git commit:
git commit -m "perf: configure outputFileTracingExcludes and serverExternalPackages in next.config.ts"
```

---

### Task 3: Post-Optimization Verification & Comparative Delta Analysis

**Files:**

- Test: Build output trace files under `.next/server/`

**Interfaces:**

- Consumes: `.next/server/**/*.nft.json` generated by optimized build.
- Produces: Direct before-vs-after comparison displaying the reduction delta (MB and % reduction per route and total).

- [x] **Step 1: Run local optimized build and audit**

Run: `npx next build && npm run audit:bundle`  
Expected:

- Build succeeds cleanly.
- Uncompressed database routes drop from ~95.7 MB down to ~38.5 MB (~57 MB uncompressed saved per database function).
- Grand total uncompressed footprint drops from ~1.40 GB down to ~630 MB.

- [x] **Step 2: Run simulated Vercel deployment build and audit**

Run: `VERCEL=1 npx next build && npm run audit:bundle`  
Expected:

- Build succeeds cleanly.
- Alpine `libquery_engine-linux-musl*` engine is excluded on Vercel target.
- Uncompressed database routes drop from ~95.7 MB down to ~21.8 MB (~74 MB uncompressed saved per database function).
- Grand total uncompressed footprint drops from ~1.40 GB down to ~390 MB (~72% total reduction).

- [x] **Step 3: Checkpoint verification evidence (Ask user before committing)**

```bash
# Verify no untracked artifacts remain; prompt user for explicit consent before committing:
git status
```

---

### Task 4: Full Quality Gate & Documentation Synchronization

**Files:**

- Modify: `docs/roadmap.md`
- Test: `npm run check:all`

**Interfaces:**

- Consumes: All tests, linter, TypeScript compiler, security scanner.
- Produces: Clean release verification evidence.

- [x] **Step 1: Run complete repository verification suite**

Run: `npm run check:all`  
Expected: All 6 gates pass:

1. `typecheck` (tsc) -> 0 errors.
2. `test` (vitest) -> all unit tests pass.
3. `lint` (eslint) -> 0 errors.
4. `format:check` (prettier) -> clean.
5. `audit:check` (audit-ci) -> 0 vulnerabilities, 0 bypasses.
6. `scan:secrets` (secretlint) -> 0 secrets found.

- [x] **Step 2: Update `docs/roadmap.md` to link implementation plan**

Update roadmap status:
`- **Status:** [ ] Plan Ready: [docs/superpowers/plans/2026-11-15-vercel-storage-optimization.md](superpowers/plans/2026-11-15-vercel-storage-optimization.md)`

- [x] **Step 3: Checkpoint documentation synchronization (Ask user before committing)**

```bash
git add docs/roadmap.md
# Prompt user for explicit consent before running git commit:
git commit -m "docs: link bundle optimization implementation plan in roadmap"
```
