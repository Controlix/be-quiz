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
});
