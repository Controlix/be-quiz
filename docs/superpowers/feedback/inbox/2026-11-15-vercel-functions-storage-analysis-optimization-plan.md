# Vercel Functions Storage Analysis & Optimization Plan

> **Status Update (2026-11-23):** Deployments were pruned manually and Vercel retention policies updated, resolving immediate quota pressure. Deeper bundle tracing optimization remains a valid improvement for future maintenance, but is deprioritized from active urgent status.

## 1. Executive Summary

- **Current Usage:** `7.42 GB / 10 GB` (74% of the Vercel Hobby plan limit) across two projects (`be-quiz` at ~4.6–4.7 GB and `be-quiz-2` at ~2.7–2.8 GB).
- **Deployment Storage:** `73.44 MB / 10 GB` (not an issue).
- **Root Cause:** Each deployment generates **17 distinct Serverless Function bundles** (`PAGE`, `API`, and `_middleware`), each weighing **~42.4 MB to 43.0 MB compressed** (~100–102 MB uncompressed). A single deployment consumes **~729 MB** of Functions Storage, meaning retaining ~10 deployments across both projects pushes total usage past 7.4 GB.

---

## 2. Single Deployment Resource Breakdown

| Artefact Category               | Count  | Individual Size (Compressed) | Individual Size (Uncompressed) | Total Contribution | Notes                                                                |
| :------------------------------ | :----: | :--------------------------: | :----------------------------: | :----------------: | :------------------------------------------------------------------- |
| **Static Assets**               |   33   |       ~9 B – 482.8 KB        |               —                |    **~1.63 MB**    | Counts toward Deployment Storage (negligible)                        |
| **Page Functions (`PAGE`)**     |   11   |  `43,001,351 B` (~43.0 MB)   |  `101,900,216 B` (~101.9 MB)   |   **~473.0 MB**    | Identical bundle size across every page route (`iad1`, `nodejs24.x`) |
| **API Functions (`API`)**       |   5    |  `42,748,010 B` (~42.7 MB)   |  `101,081,348 B` (~101.1 MB)   |   **~213.7 MB**    | Identical bundle size across every API route (`iad1`, `nodejs24.x`)  |
| **Middleware (`/_middleware`)** |   1    |  `42,447,371 B` (~42.4 MB)   |  `100,187,078 B` (~100.2 MB)   |    **~42.4 MB**    | Node.js runtime (`nodejs24.x`) deployed with `"regions": ["all"]`    |
| **Total per Deployment**        | **50** |              —               |               —                |   **~729.2 MB**    | **~727.5 MB** in Functions Storage alone                             |

### Affected Function Routes

- **Pages (`43.0 MB` each):** `/`, `/_global-error`, `/admin`, `/admin/feedback`, `/admin/members`, `/admin/settings`, `/auth/login`, `/quizzes`, `/quizzes/[id]`, `/quizzes/[id]/edit`, `/quizzes/new`
- **APIs (`42.7 MB` each):** `/api/quizzes/[id]/calendar.ics`, `/api/quizzes/extract`, `/api/quizzes/upload-flyer`, `/auth/join`, `/auth/logout`
- **Middleware (`42.4 MB`):** `/_middleware`

---

## 3. Why Bundle Sizes Are Inflated

1. **Shared Dependency Duplication Across Routes:** Because all 11 `PAGE` functions share the exact same byte size (`43,001,351 B`) and all 5 `API` functions share the exact same byte size (`42,748,010 B`), Next.js output file tracing is packaging a large shared server dependency tree into **every single route bundle independently**.
2. **Heavy Server Packages in Extraction/Upload Flows:** Routes like `/api/quizzes/extract` and `/api/quizzes/upload-flyer` typically pull in heavy libraries (e.g., `sharp`, `pdfjs-dist`, `tesseract.js`, `canvas`, `@aws-sdk/*`, `googleapis`, or large icon/AI SDKs) that get traced into unrelated routes.
3. **Heavy Node.js Middleware (`/_middleware`):** Running Node.js middleware (`nodejs24.x`) across `"regions": ["all"]` that imports database/auth SDKs adds another full `42.4 MB` bundle on every deployment.
4. **High Deployment Retention:** Vercel retains Production, Preview, Errored, and Canceled snapshots so rollbacks and preview links work, multiplying the ~729 MB footprint per retained build.

---

## 4. Actionable Optimization Recommendations

### Step 1: Immediate Vercel Dashboard Cleanup (Zero Code Changes)

1. **Shorten Deployment Retention Policies** in **Project Settings > Deployment Retention** for both `be-quiz` and `be-quiz-2`:
   - **Preview (Pre-Production):** `1–3 days`
   - **Canceled / Errored:** `1 day`
   - **Production:** `7–14 days` (or keep only the last few releases)
2. **Delete Unused Old Deployments:** Open the **Deployments** tab in both projects, filter by Preview/Canceled/Errored, and delete old snapshots.
3. **Retire Superseded Project:** If `be-quiz-2` replaces `be-quiz`, delete `be-quiz` (or clear all its non-production deployments) to immediately reclaim ~4.6 GB once Vercel's rolling usage window updates.

### Step 2: Audit What Is Inside the ~43 MB Function Trace

Run a local production build (`npm run build`) and inspect the generated `.next/server/**/*.nft.json` trace files (or use `@next/bundle-analyzer`) to identify the largest files/packages being copied into every route.

### Step 3: Trim Next.js Function Bundles (`next.config.ts` / `next.config.mjs`)

1. **Exclude unnecessary build/native binaries from output tracing:**
   ```ts
   import type { NextConfig } from "next";

   const nextConfig: NextConfig = {
     outputFileTracingExcludes: {
       "*": [
         "node_modules/@swc/core*",
         "node_modules/@esbuild*",
         "node_modules/webpack*",
         "node_modules/terser*",
         // Add any heavy platform-specific binaries identified in .nft.json
       ],
     },
     // Prevent heavy server-only SDKs from being duplicated/inlined into route chunks
     serverExternalPackages: [
       // e.g., 'sharp', 'pdfjs-dist', 'tesseract.js'
     ],
   };

   export default nextConfig;
   ```
2. **Lightweight Middleware / Proxy:** Remove heavy database clients or full auth SDKs from `middleware.ts` / `proxy.ts`. Perform stateless JWT/cookie verification in middleware and leave database lookups to individual pages/API routes so `/_middleware` shrinks from `42.4 MB` to `< 1 MB`.
3. **Consolidate Small API Routes (Optional):** Group related endpoints (such as `/auth/join` + `/auth/logout` or `/api/quizzes/*`) into fewer route handlers to reduce the total number of separate serverless function artefacts per deployment.

---

## 5. Verification Checklist

- [ ] Retention policies updated in both `be-quiz` and `be-quiz-2`.
- [ ] Old preview/failed deployments deleted from both projects.
- [ ] Local `.nft.json` files audited for oversized dependencies.
- [ ] New deployment inspected under **Deployment > Resources** confirming individual function sizes have dropped well below 43 MB.
