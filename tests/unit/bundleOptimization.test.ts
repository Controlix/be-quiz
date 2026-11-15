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
    expect(proxyContent).not.toContain("@/lib/auth");
    expect(proxyContent).not.toContain("bcrypt");
  });

  it("verifies instrumentation and event subscribers avoid static database imports", () => {
    const instrumentationPath = path.resolve(process.cwd(), "src/instrumentation.ts");
    const prunerSubscriberPath = path.resolve(process.cwd(), "src/lib/storagePrunerSubscriber.ts");
    const calendarSubscriberPath = path.resolve(
      process.cwd(),
      "src/features/calendar/shared/subscriber.ts"
    );

    const instrumentationContent = fs.readFileSync(instrumentationPath, "utf8");
    const prunerSubscriberContent = fs.readFileSync(prunerSubscriberPath, "utf8");
    const calendarSubscriberContent = fs.readFileSync(calendarSubscriberPath, "utf8");

    // instrumentation.ts must have zero database references
    expect(instrumentationContent).not.toMatch(/from\s+["']@\/lib\/db["']/);
    expect(instrumentationContent).not.toMatch(/from\s+["']@prisma\/client["']/);

    // storagePrunerSubscriber.ts must not statically import storagePruner or db
    expect(prunerSubscriberContent).not.toMatch(/from\s+["']@\/lib\/storagePruner["']/);
    expect(prunerSubscriberContent).not.toMatch(/from\s+["']@\/lib\/db["']/);
    expect(prunerSubscriberContent).not.toMatch(/from\s+["']@prisma\/client["']/);

    // calendar subscriber must not statically import db or mappingRepository
    expect(calendarSubscriberContent).not.toMatch(/from\s+["']@\/lib\/db["']/);
    expect(calendarSubscriberContent).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(calendarSubscriberContent).not.toMatch(/from\s+["']\.\/mappingRepository["']/);
  });

  it("enforces instrumentation trace manifest invariants when build artifacts exist", () => {
    const nftPath = path.resolve(process.cwd(), ".next/server/instrumentation.js.nft.json");
    if (!fs.existsSync(nftPath)) {
      // In clean workspace or before build, manifest check is safely skipped
      return;
    }

    const nftDir = path.dirname(nftPath);
    const data = JSON.parse(fs.readFileSync(nftPath, "utf8")) as { files: string[] };

    // Zero WASM files or base64 wasm compilers in instrumentation trace
    const wasmFiles = data.files.filter((f) => f.includes(".wasm") || f.includes("wasm-base64"));
    expect(wasmFiles).toEqual([]);

    // Calculate uncompressed footprint
    let totalBytes = 0;
    for (const f of data.files) {
      const absPath = path.resolve(nftDir, f);
      try {
        const stat = fs.statSync(absPath);
        if (stat.isFile()) totalBytes += stat.size;
      } catch {}
    }

    // Must be <= 25 MB uncompressed ceiling
    const maxBytes = 25 * 1024 * 1024;
    expect(totalBytes).toBeLessThanOrEqual(maxBytes);
  });
});
