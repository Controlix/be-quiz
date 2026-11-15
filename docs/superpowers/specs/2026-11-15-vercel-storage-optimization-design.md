# Design Specification: Vercel Functions Storage & Serverless Bundle Optimization

**Date:** 2026-11-15  
**Topic:** Vercel Functions Storage & Serverless Bundle Optimization (Roadmap Item #12)  
**Status:** In Review (Brainstorming / Spec Phase)  
**Target Branch:** `perf/vercel-bundle-optimization`

---

## 1. Intent and Why

Vercel Functions Storage usage has reached **7.42 GB / 10 GB (74%)** across `be-quiz` (~4.6 GB) and `be-quiz-2` (~2.7 GB), approaching the Hobby plan hard ceiling. Every deployment produces **17 distinct Serverless Function bundles** (11 pages, 5 API routes, 1 middleware), each weighing **~42.4 MB to 43.0 MB compressed (~101 MB uncompressed)**. A single deployment burns **~729 MB** of Functions Storage, meaning retaining just ~10 deployment snapshots across both projects exhausts the 7.4 GB allocation.

The purpose of this project is to drastically reduce the per-deployment Functions Storage footprint by identifying and eliminating redundant output file tracing artifacts, excluding unnecessary build/runtime binaries, configuring external packages in Next.js, and ensuring middleware does not pull heavy dependencies into global route execution.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- Audit the `.next/server/**/*.nft.json` trace output to identify the exact bloated packages and binaries replicated across all 17 functions.
- Configure `next.config.ts` with targeted `outputFileTracingExcludes` to prevent compiler binaries (`@swc/core*`, `webpack*`, `esbuild*`), unneeded platform engines, and heavy static files from being traced into serverless functions.
- Configure `serverExternalPackages` for heavy server-only packages that should not be inlined or traced redundantly.
- Ensure `src/proxy.ts` / `middleware` maintains a lightweight execution graph without pulling in database clients or heavy server runtime assets.
- Validate that `npm run check:all` (typecheck, tests, lint, format, audit, secretlint) and local builds pass cleanly.
- Ensure Docker standalone builds (`output: "standalone"`) continue to build and function without regressions.

### Non-Goals

- Restructuring public API routes or changing endpoint paths/contracts (`docs/api/openapi.yaml`).
- Converting dynamic team lineup and RSVP pages to static (`SSG`) or ISR pages where stale caches would compromise real-time coordination.
- Replacing Prisma ORM with another database client in this milestone.

### Anti-Goals

- Introducing breaking runtime errors by excluding required production runtime dependencies (e.g., active Prisma query engines required at Lambda runtime).
- Modifying application features or user-facing UI behavior under the guise of bundle optimization.

---

## 3. Constraints

- **Next.js 16 Compatibility:** Next.js 16 (`16.4.3`) uses `serverExternalPackages` (formerly `serverComponentsExternalPackages`) and `outputFileTracingExcludes`. Configurations must adhere to Next.js 16 configuration schema.
- **Dual Compute Support:** Changes must maintain compatibility with both Vercel Serverless deployment and Docker standalone container deployment (`output: "standalone"`).
- **Zero Security Scanner Bypasses:** No security exceptions in `audit-ci.json` or bypassed secret linting.
- **Deterministic Testing:** Vitest test suite (`npm run test`) must execute cleanly in Node.js without degradation.

---

## 4. Approaches Considered

### Approach 1: Deep Trace Analysis & Build Configuration Tuning (Selected)

- **Description:** Run a local production build to inspect `.next/server/**/*.nft.json` trace files and pinpoint the exact oversized packages replicated across all 17 functions. Apply `outputFileTracingExcludes` and `serverExternalPackages` in `next.config.ts`, while auditing `proxy.ts`/middleware to prevent heavy ORM/crypto modules from deploying into the global middleware layer.
- **Trade-offs:** Attacks the true root cause directly across all 17 functions simultaneously without changing URL paths, modifying API contracts, or altering application behavior.
- **Selection Reason:** Chosen by user. Solves the issue holistically at the build/packaging layer.

### Approach 2: API Route Consolidation & Middleware Removal

- **Description:** Actively merge smaller API routes into consolidated dispatch handlers and eliminate `_middleware` entirely by moving auth verification into layout guards and Server Actions.
- **Trade-offs:** Drops function count from 17 to ~12, but introduces unnecessary refactoring churn, API contract changes, and risk of regressions.

### Approach 3: Static Pre-rendering & Route Decoupling

- **Description:** Re-architect pages like `/auth/login` to static SSG.
- **Trade-offs:** Only saves 1–2 functions while risking stale state and adding caching complexity.

---

## 5. Technical Specification & Implementation Strategy

### 5.1 Output File Tracing Audit

1. Execute a Next.js production build (`npx next build`).
2. Analyze generated `.nft.json` trace files under `.next/server/pages`, `.next/server/app`, and `.next/server/middleware` (or `proxy`).
3. Tally total file sizes by package/directory in the trace to identify top contributors to the ~101 MB uncompressed footprint.

### 5.2 Build Configuration Optimization (`next.config.ts`)

1. Configure `outputFileTracingExcludes` with glob patterns for packages identified as build-only or non-runtime bloat:
   - `@swc/core*`
   - `esbuild*`
   - `webpack*`
   - `terser*`
   - Unused native binaries or docs/test directories within dependencies.
2. Verify `serverExternalPackages` configuration for packages that should be loaded externally by Node.js instead of being traced/bundled redundantly.

### 5.3 Middleware / Proxy Guard

1. Verify `src/proxy.ts` imports only lightweight utilities (`next/server`, `@/lib/requestUrl`).
2. Ensure no transitive database or heavy crypto imports leak into `proxy.ts`.

### 5.4 Verification & Validation

1. Re-run `npx next build` and inspect the newly generated `.nft.json` trace file sizes.
2. Measure the reduction in traced files and overall function bundle size.
3. Run `npm run check:all` to verify zero typecheck, lint, test, or formatting regressions.

---

## 6. What's Left to the Builder

- Exact regex/glob patterns in `outputFileTracingExcludes` based on empirical `.nft.json` inspection.
- Determining whether `serverExternalPackages` needs specific additions (e.g. `@prisma/client`, `@vercel/blob`) or if Next.js handles them natively.
- Verifying that runtime execution of Server Actions and API routes behaves identically after exclusions.
