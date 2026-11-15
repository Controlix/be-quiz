# User Feedback & Defect Intake: Instrumentation Trace Leakage & Acceptance Criteria Flaw

**Date:** 2026-11-15  
**Topic:** Next.js `instrumentation.js` Trace Leakage & Incomplete Bundle Optimization  
**Context:** Feature Branch `perf/vercel-bundle-optimization`

---

## 1. Observation & User Feedback

During review and verification of the initial bundle optimization implementation:

- All 16 serverless page and API routes (`app/**`) were successfully reduced from ~95.7 MB uncompressed down to **~22.4–23.5 MB uncompressed** (~12–14 MB compressed).
- However, `instrumentation` remained at its full unoptimized size of **95.29 MB**, retaining **57.1 MB of `@prisma/client`** (including ~27 MB of dead WASM compilers and the Alpine `linux-musl` query engine).
- **User Remark:** _"i see that 'instrumentation' is still its original size of 95MB... why did you conclude the work was done, while this issue clearly remains. i think the acceptance criteria were wrong."_

---

## 2. Root Cause Analysis

### A. Next.js 16 Built-in Tracing Scope

- In Next.js 16 (`collect-build-traces.js`), `outputFileTracingExcludes` rules are only applied to entries that belong to `entryNameFilesMap`, which only tracks entries matching `isApp || isPage || isMiddleware`.
- `instrumentation.js` is a root-level server hook, not an HTTP route. Turbopack emits `.next/server/instrumentation.js.nft.json` directly from native AST analysis, and Next.js's `apply-include-excludes` post-compilation filter completely skips it.
- As a result, the `outputFileTracingExcludes: { "*": [...] }` rule in `next.config.ts` was silently bypassed for `instrumentation.js.nft.json`.

### B. Static Dependency Graph in Event Subscribers

- `src/instrumentation.ts` registers two event bus subscribers on boot: `registerStoragePrunerSubscriber` and `registerSharedCalendarSubscriber`.
- `src/lib/storagePrunerSubscriber.ts` statically imports `pruneOrphanedUploads` from `@/lib/storagePruner`, which imports `db` from `@/lib/db`.
- `src/features/calendar/shared/subscriber.ts` statically imports `prisma` from `@/lib/db`.
- Even though the subscribers only execute database operations when an event is emitted (never on cold boot), Turbopack statically traces the entire Prisma dependency tree into `instrumentation.js.nft.json`.

### C. Vercel Lambda Impact via `sharedNodeAssets`

- In Vercel's deployment adapter (`node_modules/next/dist/build/adapter/build-complete.js`, line 1571):
  ```js
  const { entryHash } = await loadNFT(sharedNodeAssets, ..., 'instrumentation.js.nft.json');
  Object.assign(assets, sharedNodeAssets);
  ```
- Because Vercel's adapter ingests `instrumentation.js.nft.json` into `sharedNodeAssets` and merges it into **every single function bundle**, leaving 95 MB unpruned in `instrumentation` risks leaking the dead WASM chunks and Alpine binary into the shared Lambda asset pool.

---

## 3. What Was Wrong with the Original Acceptance Criteria

1. **Assumed Global Config Coverage:** Assumed Next.js `outputFileTracingExcludes: { "*": [...] }` would automatically prune non-route entrypoints.
2. **Per-Route Evaluation in Isolation:** Only validated that database route functions (`app/**`) shrank to ~21–23 MB, ignoring the `instrumentation` outlier.
3. **Weak Unit Test Assertions:** The unit test only checked that `nextConfig.outputFileTracingExcludes` defined certain string globs, rather than validating the empirical `.nft.json` output files emitted by the build.
4. **No Ceiling Guardrail:** Lacked an absolute ceiling constraint (e.g. no traced function may exceed 25 MB on Vercel target).

---

## 4. Corrected Acceptance Criteria

To declare the optimization complete:

1. **Manifest File Guard:** Across ALL `.nft.json` trace manifests under `.next/server/` (including `instrumentation.js.nft.json`):
   - Zero `.wasm` files.
   - Zero `*wasm-base64*` compiler files.
   - Zero `libquery_engine-linux-musl*` binaries when building for Vercel (`VERCEL=1`).
2. **Uniform Size Ceiling:** No traced function or root hook (including `instrumentation`) may exceed **25 MB uncompressed** on the Vercel build target.
3. **Decoupled Boot Hook:** `src/instrumentation.ts` must not statically trace `@prisma/client`. Event subscribers must defer database client loading until an event actually fires.
4. **End-to-End Test Assertion:** `tests/unit/bundleOptimization.test.ts` must inspect `.next/server/instrumentation.js.nft.json` directly and assert that it meets these constraints.
