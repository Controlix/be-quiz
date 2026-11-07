# Completed Roadmap Items: Release v2.2.0

**Archived Date:** 2026-11-07  
**Milestone:** v2.2.0 (Opportunistic Storage Garbage Collection & Orphan Pruning)  
**Specification:** `docs/superpowers/specs/2026-11-07-opportunistic-storage-garbage-collection-design.md`  
**Implementation Plan:** `docs/superpowers/plans/2026-11-07-opportunistic-storage-garbage-collection.md`  
**Architecture Decision Record:** `docs/adr/0007-opportunistic-storage-garbage-collection.md`

---

### 1. Orphaned Uploads & Storage Garbage Collection (Storage Leak)

- **Completed Status:** `[x] Shipped in v2.2.0`
- **Problem / Feedback:** When users dropped, uploaded, or pasted a flyer in `FlyerUploader` but did not submit/save the quiz (or uploaded multiple images while testing), files were immediately written to storage and never deleted.
- **Observed Evidence:**
  - **Locally:** 22 out of 27 files in `public/uploads/` were unreferenced orphans before being pruned.
  - **Production (Vercel Blob):** In `be-quiz-blob`, 22 out of 24 files (totaling 4.17 MB) were unreferenced orphans, while the production database only had 2 active quiz flyer URLs.
- **Root Cause:** Eager upload on file selection writes directly to storage before quiz submission, with zero cleanup or TTL garbage collection for unreferenced files.
- **Delivered Solution:**
  1. **Dual Storage Pruning:** Core pruning service (`src/lib/storagePruner.ts`) supporting both local filesystem (`public/uploads` including `feedback/`) and cloud storage (`@vercel/blob` via cursor pagination with `list()` and `del()`).
  2. **Safe Retention Window (TTL):** Deletes only files that are unreferenced in the database AND older than 24 hours (`now - mtime < 24h` or `now - uploadedAt < 24h`), ensuring in-progress quiz creation forms are never interrupted.
  3. **Event-Driven Decoupled Trigger:** Upload functions (`saveUploadedFlyer` and `saveUploadedFeedbackImage`) emit `asset.uploaded` on `domainEvents`. A dedicated subscriber (`registerStoragePrunerSubscriber`) runs background garbage collection via Next.js `after()`, returning instant upload responses to the user.
  4. **Process-Wide Cooldown Throttling:** Background pruning is throttled to at most once every 24 hours via `globalThis.__beQuizLastPruneTimestamp`.
  5. **Standalone CLI Utility:** Refactored `scripts/prune-uploads.ts` with `--dry-run` and `--force` options for one-off storage audits and developer cleanups.
