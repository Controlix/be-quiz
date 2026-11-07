# ADR 0007: Opportunistic Storage Garbage Collection & Orphan Pruning

**Date:** 2026-11-07  
**Status:** Accepted  
**Deciders:** Team & Architecture Lead

---

## Context & Problem Statement

In `be-quiz`, user assets (flyers and feedback screenshots) are uploaded eagerly upon file selection/pasting so AI vision extraction and UI previews can proceed immediately. However, if a user changes the file, cancels, or abandons the quiz creation or feedback form, the uploaded files remain permanently stored.

In production on Vercel Blob (`be-quiz-blob`), 22 out of 24 stored files were unreferenced orphans, costing unnecessary storage footprint and monthly costs. Locally, unreferenced files accumulate in `public/uploads/`.

Initial proposals considered a periodic Vercel Cron job triggering an HTTP endpoint (e.g. `GET /api/cron/prune-uploads`). However, executing destructive file deletions via an HTTP `GET` request violates fundamental HTTP semantics (RFC 7231 / RFC 9110), where `GET` must be safe and idempotent. Furthermore, managing external cron schedules or webhooks adds unnecessary operational surface area.

## Decision Drivers

- **Strict HTTP Semantics:** `GET` requests must remain safe, read-only, and idempotent. Destructive mutations should never be triggered by `GET`.
- **Minimal Operational Surface Area:** Avoid unnecessary external cron dependencies, API routes, and webhook configurations where simpler in-app mechanics suffice.
- **Zero User-Facing Latency:** Upload responses must not be slowed down by storage audits or batch deletions.
- **Data Safety (24h TTL):** Prevent race conditions by strictly retaining unreferenced files younger than 24 hours so active in-flight forms are never disrupted.
- **Dual Storage Engine Support:** Unified pruning support across both Local Volume Storage (`public/uploads`) and Cloud Object Storage (`@vercel/blob`).

## Considered Options

1. **Option 1: Vercel Cron via HTTP Route (`GET /api/cron/prune-uploads`)**
   - _Pros:_ Runs on a predictable wall-clock schedule.
   - _Cons:_ Vercel Cron only emits `GET` requests, violating HTTP specifications for safe methods. Exposes an unnecessary public endpoint and requires secret rotation.
2. **Option 2: Standalone Worker / Scheduled CLI (External Runner)**
   - _Pros:_ Pure backend execution without any HTTP endpoints.
   - _Cons:_ Vercel is a serverless platform with no persistent server or cron daemon; running CLI scripts automatically requires external runners (e.g. GitHub Actions or VPS crontabs).
3. **Option 3: Opportunistic In-Process Garbage Collection on Upload + Standalone CLI Script (Selected)**
   - _Pros:_ Completely self-contained within the application runtime. Storage only expands on upload, so triggering GC on upload guarantees garbage is collected proportionally to usage. Background execution via Next.js `after()` ensures zero latency for uploading users. Throttled (e.g. 24h window) to prevent redundant executions.
   - _Cons:_ GC frequency is tied to upload activity rather than a fixed clock (acceptable because storage only accumulates during upload activity).

## Decision Outcome

We chose **Option 3 (Opportunistic In-Process Garbage Collection on Upload + Standalone CLI Script)**.

The system will:

1. Provide a core domain service (`pruneOrphanedUploads`) supporting both local filesystem and `@vercel/blob` with a strict 24-hour TTL check.
2. Decouple upload flows via the existing `domainEvents` bus: when an asset is saved, it emits an `asset.uploaded` domain event. The upload route remains completely agnostic of garbage collection.
3. Register a garbage collection subscriber for `asset.uploaded` that throttles runs via a 24-hour `globalThis` cooldown and executes safely in the background via the event bus's built-in Next.js `after()` coordination.
4. Provide a standalone CLI script (`npm run prune-uploads` / `tsx scripts/prune-uploads.ts`) supporting `--dry-run` and `--force` for manual maintenance and one-time backlog migrations.

## Consequences

- **Positive:**
  - Zero external cron dependencies, webhooks, or `vercel.json` cron configurations required.
  - Zero risk of destructive deletions triggered via HTTP `GET` requests or web crawlers.
  - Zero perceptible latency for uploading users due to non-blocking `after()` scheduling.
  - Storage is pruned automatically in both local development and production Vercel Blob environments.
- **Negative / Trade-offs:**
  - If no uploads occur over a period, orphaned files from abandoned forms remain until the next upload or manual CLI run.
- **Invariants Introduced:**
  - All unreferenced files younger than 24 hours are strictly protected from deletion.
  - In-process throttling state must be anchored to `globalThis` to prevent divergence across Next.js Webpack chunks.

## Validation & Confirmation

- Automated unit and integration tests under Node.js with Vitest (`tests/unit/storagePruner.test.ts`) covering 24h retention window, reference matching, dry-run safety, and throttle limits.
- Manual one-time verification via `npm run prune-uploads -- --dry-run` to inspect and prune existing storage backlogs.
