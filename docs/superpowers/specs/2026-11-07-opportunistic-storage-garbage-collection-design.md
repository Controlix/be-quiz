# Design Specification: Opportunistic Storage Garbage Collection & Orphan Pruning

**Document:** `docs/superpowers/specs/2026-11-07-opportunistic-storage-garbage-collection-design.md`  
**Date:** 2026-11-07  
**Status:** In Review  
**Milestone:** v1.1 Polish / Roadmap Item 1

---

## 1. Intent & The Why

In `be-quiz`, user assets (quiz flyers and in-app feedback screenshots) are uploaded eagerly to storage upon file selection/pasting so that AI OCR extraction and visual feedback can proceed immediately. However, if a user changes the image, cancels, or abandons the quiz creation or feedback form, the uploaded files remain permanently stored.

In production on Vercel Blob (`be-quiz-blob`), 22 out of 24 stored files were unreferenced orphans, costing unnecessary storage footprint. Similarly, local storage (`public/uploads`) accumulated unreferenced test files.

Rather than introducing an external cron service or an HTTP `GET` endpoint that violates HTTP semantics by performing destructive deletions, this design implements an **opportunistic garbage collection (GC)** architecture paired with a one-time manual cleanup script.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals

- **Dual-Storage Engine Support:** Clean up orphaned files in both Local Volume Storage (`public/uploads/` including `feedback/`) and Cloud Object Storage (`@vercel/blob` via `list()` and `del()`).
- **Safe 24-Hour TTL:** Only prune files that are both unreferenced in the database AND older than 24 hours (`uploadedAt` or `mtime < Date.now() - 24 * 60 * 60 * 1000`). Active in-flight form entries are never disrupted.
- **Opportunistic In-Process Execution:** Trigger background cleanup when uploads occur, scheduling execution via Next.js `after()` so the HTTP response returns immediately to the user with zero perceptible latency.
- **In-Memory Throttle Window:** Prevent redundant scans when multiple files are uploaded consecutively by enforcing a 24-hour throttle interval anchored to `globalThis`.
- **Standalone CLI Utility:** Support manual and scripted execution (`npm run prune-uploads`) with `--dry-run` and `--force` options for one-time migrations and diagnostics.
- **Architectural Documentation:** Formalize the decision in ADR `0007-opportunistic-storage-garbage-collection.md` and keep deployment/roadmap documentation synchronized.

### 2.2 Non-Goals

- **No Periodic HTTP Cron Endpoint:** No public HTTP `GET` or `POST` cron route handlers will be exposed in `/api/cron/*` for this feature, keeping the HTTP surface area clean and safe.
- **No Temporary Database Staging Tables:** Files are not tracked with temporary database rows before finalization; the database remains the sole authoritative source of truth for active referenced files.

### 2.3 Anti-Goals

- **No HTTP GET Mutations:** Never perform file deletion or database mutations in response to HTTP `GET` requests.
- **No Blocking Upload Delays:** Never block the user's upload response waiting for storage scans or deletions.

---

## 3. Approaches Considered & Trade-Offs

### Option 1: Vercel Cron via HTTP Route (`/api/cron/prune-uploads`)

- _Pros:_ Runs strictly on a fixed calendar clock (e.g. 03:00 UTC).
- _Cons:_ Vercel Cron only sends HTTP `GET` requests, violating HTTP REST semantics (RFC 7231 / RFC 9110) where GET must be safe and idempotent. Requires exposing an authenticated endpoint, managing `CRON_SECRET`, and configuring `vercel.json`.

### Option 2: Pure CLI / Standalone Worker (No Web Integration)

- _Pros:_ Zero HTTP surface area, no serverless timeout constraints.
- _Cons:_ On Vercel (ephemeral serverless functions), CLI scripts cannot execute automatically on a schedule without external infrastructure (e.g. GitHub Actions or external servers).

### Option 3: Opportunistic Garbage Collection on Upload + One-Time CLI Run (Selected)

- _Pros:_ Completely self-contained within the application. Zero external cron dependencies or cron configuration. Zero HTTP GET mutation. Executes in background via Next.js `after()`, maintaining zero user latency. If no uploads occur, no new orphans exist.
- _Cons:_ Pruning occurs only when upload events take place, rather than on a strict wall-clock schedule (mitigated because storage only grows on upload).

---

## 4. Detailed Architectural Design

### 4.1 Authoritative Reference Collection (`getReferencedFileKeys`)

The garbage collection service queries the single source of truth (PostgreSQL via Prisma):

1. `Quiz.findMany({ where: { flyerImageUrl: { not: null } }, select: { flyerImageUrl: true } })`
2. `Feedback.findMany({ where: { screenshot: { not: null } }, select: { screenshot: true } })`

From each URL/path:

- For local paths (e.g. `/uploads/abc.jpg` or `/uploads/feedback/def.png`), extract the relative storage path (e.g. `abc.jpg`, `feedback/def.png`).
- For Vercel Blob URLs (e.g. `https://[id].public.blob.vercel-storage.com/uploads/abc.jpg`), extract the pathname pathname relative to the bucket prefix (e.g. `uploads/abc.jpg` or `uploads/feedback/def.png`).
- Produce a `Set<string>` of protected storage keys.

### 4.2 Storage Scanners & Deletion

#### Local Disk Scanner (`scanAndPruneLocal`):

- Recursively inspects `public/uploads` (including `public/uploads/feedback`).
- For each file:
  - Check `fs.stat(filePath).mtimeMs`. If file is younger than 24 hours (`now - mtimeMs < 24h`), skip.
  - Check if the relative key is in `protectedKeys`. If referenced, skip.
  - If unreferenced and older than 24 hours:
    - If `dryRun`: log and count.
    - If not `dryRun`: `fs.unlink(filePath)`, record reclaimed bytes.

#### Vercel Blob Scanner (`scanAndPruneBlob`):

- Uses `@vercel/blob` `list({ prefix: "uploads/" })` with cursor pagination.
- For each blob item:
  - Check `blob.uploadedAt`. If younger than 24 hours (`now - uploadedAt < 24h`), skip.
  - Check if blob pathname/url matches any `protectedKeys`. If referenced, skip.
  - If unreferenced and older than 24 hours:
    - If `dryRun`: log and count.
    - If not `dryRun`: `del(blob.url)`, record reclaimed bytes.

### 4.3 Decoupled Event-Driven Trigger via `domainEvents`

The codebase already possesses an authoritative in-process event bus (`domainEvents` in `src/lib/events/`), anchored to `globalThis` with automatic Next.js `after()` coordination for serverless environments.

1. **Domain Event Declaration (`src/lib/events/types.ts`):**

   ```typescript
   export type DomainEvent =
     | ...
     | { type: "asset.uploaded"; url: string; category: "flyer" | "feedback"; occurredAt: Date };
   ```

2. **Event Emission in Upload Flows:**
   Upon successful save in `saveUploadedFlyer` or `saveUploadedFeedbackImage`, the upload service emits the event:

   ```typescript
   domainEvents.emit({
     type: "asset.uploaded",
     url: savedUrl,
     category: "flyer",
     occurredAt: new Date(),
   });
   ```

   The upload endpoint knows _nothing_ about pruning or garbage collection.

3. **Decoupled Garbage Collection Subscriber:**
   A dedicated listener subscribes to `"asset.uploaded"`:
   - Evaluates the 24-hour throttle timestamp (`globalThis.__beQuizLastPruneTimestamp`).
   - If elapsed (>= 24h), triggers `pruneOrphanedUploads({ dryRun: false })`.
   - Because `EventBus.emit()` already handles asynchronous handlers by wrapping them in Next.js `after()`, the listener runs completely out-of-band in the background without delaying the user's upload response.
   - Swapping, disabling, or modifying the pruning strategy requires zero changes to upload handlers.

### 4.4 Standalone CLI Utility (`scripts/prune-uploads.ts`)

- Executed via `npm run prune-uploads` or `tsx scripts/prune-uploads.ts [--dry-run] [--force]`.
- `--dry-run`: Reports candidates without deleting.
- `--force`: Bypasses the 24-hour TTL check (useful for manual developer cleanup in local testing). Defaults to preserving the 24h TTL.
- Outputs detailed summary: files examined, kept, deleted, bytes reclaimed, duration.

---

## 5. Architectural Decision Record (ADR 0007)

A dedicated ADR `docs/adr/0007-opportunistic-storage-garbage-collection.md` will be created using `docs/adr/template.md`, documenting:

- Context: Eager uploads causing orphaned blobs and local files.
- Decision Drivers: REST semantics (no destructive GET), zero external cron complexity, zero user-facing latency.
- Considered Options: Vercel Cron via GET/POST, Scheduled Worker/GitHub Actions, Opportunistic GC on upload.
- Outcome: Opportunistic GC on upload + one-time manual cleanup script.

---

## 6. Testing & Verification Plan

1. **Unit / Integration Tests (`tests/unit/storagePruner.test.ts`):**
   - Test reference extraction logic from mock Prisma records.
   - Test local pruning: verify files < 24h are retained even if unreferenced.
   - Test local pruning: verify referenced files are retained regardless of age.
   - Test local pruning: verify unreferenced files > 24h are deleted and sizes tallied.
   - Test dry-run mode: verify no filesystem unlinks occur when `dryRun: true`.
   - Test throttling: verify consecutive calls within 24h skip execution.
2. **Deterministic Node-Based Execution:**
   - Vitest runs purely under Node.js without browser DOM mocks.
   - File operations use mock directories or Vitest spies.
3. **Full Health Verification:**
   - `npm run check:all` passes cleanly (typecheck, tests, lint, format, audit-ci, secretlint).
