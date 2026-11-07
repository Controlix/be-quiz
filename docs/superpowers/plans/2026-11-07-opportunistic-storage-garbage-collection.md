# Opportunistic Storage Garbage Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement decoupled, opportunistic storage garbage collection triggered via domain events on file uploads with a 24-hour TTL and dual-storage (local disk and Vercel Blob) support, paired with a refactored standalone CLI script for manual and one-off backlog cleanup.

**Architecture:** When flyer or feedback image uploads succeed, the storage service emits an `asset.uploaded` domain event on `domainEvents`. A dedicated subscriber (`registerStoragePrunerSubscriber`) listens to this event, checks a 24-hour cooldown anchored to `globalThis`, and delegates to `pruneOrphanedUploads` which scans local/cloud storage against active database references (`Quiz.flyerImageUrl` and `Feedback.screenshot`), deleting unreferenced files older than 24 hours. The subscriber runs out-of-band in the background via `domainEvents`'s built-in Next.js `after()` coordination.

**Tech Stack:** Next.js 16 (App Router & `next/server` `after()`), Prisma ORM (PostgreSQL), `@vercel/blob`, Node.js `fs/promises`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-opportunistic-storage-garbage-collection-design.md`  
**ADR:** `docs/adr/0007-opportunistic-storage-garbage-collection.md`

## Global Constraints

- Never execute `git commit` without explicit consent from the user.
- Zero DOM or browser emulation dependencies in unit tests: tests run in Vitest under the Node.js environment.
- Any process-wide state (such as the 24h prune cooldown timestamp) must be anchored to `globalThis` to avoid divergence across Next.js Webpack chunk closures.
- Retention window (TTL): Never delete any file younger than 24 hours (86,400,000 ms), even if it is not yet referenced in the database, unless `--force` is explicitly provided in the CLI script.
- Dual storage support: Local files are pruned in `public/uploads/` (including `feedback/`); Vercel Blob files are listed via `list({ prefix: "uploads/" })` and deleted via `del()` when `BLOB_READ_WRITE_TOKEN` is present.

## Review Focus

1. **Active in-flight uploads:** An unreferenced file created 5 minutes ago must NOT be deleted during an opportunistic prune run.
2. **External image URLs:** If a database quiz references an external image (e.g. `https://images.unsplash.com/...`), `extractStorageKey` must return `null` and not cause false deletions or throw errors.
3. **Chunk singletons:** In-memory throttle timestamp must be anchored to `globalThis` (`globalThis.__beQuizLastPruneTimestamp`) so multiple Next.js chunks do not run duplicate concurrent scans.
4. **Vercel Blob pagination:** When listing blobs in production, if there are more than 1,000 blobs, the scanner must paginate using the `cursor` returned by `@vercel/blob`'s `list()`.
5. **Dry-run safety:** When `dryRun: true` is passed, no files are unlinked from disk and no calls to `@vercel/blob`'s `del()` are made.

---

### Task 1: Domain Event Definition (`asset.uploaded`)

**Files:**

- Modify: `src/lib/events/types.ts:1-16`
- Test: `tests/lib/events.test.ts`

**Interfaces:**

- Produces: `DomainEvent` union with `{ type: "asset.uploaded"; url: string; category: "flyer" | "feedback"; occurredAt: Date }`

- [x] **Step 1: Write the failing test**

In `tests/lib/events.test.ts`, add a test verifying `asset.uploaded` event emission and subscription:

```typescript
it("emits and receives asset.uploaded domain events", () => {
  const bus = new EventBus();
  const received: any[] = [];
  bus.subscribe("asset.uploaded", (e) => {
    received.push(e);
  });

  const now = new Date();
  bus.emit({
    type: "asset.uploaded",
    url: "/uploads/test-flyer.jpg",
    category: "flyer",
    occurredAt: now,
  });

  expect(received).toHaveLength(1);
  expect(received[0].url).toBe("/uploads/test-flyer.jpg");
  expect(received[0].category).toBe("flyer");
  expect(received[0].occurredAt).toEqual(now);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/events.test.ts`  
Expected: FAIL with TypeScript / runtime error indicating `"asset.uploaded"` is not assignable to `DomainEvent["type"]`.

- [x] **Step 3: Implement `asset.uploaded` in `src/lib/events/types.ts`**

Add the variant to `DomainEvent`:

```typescript
export type DomainEvent =
  | { type: "team.registered"; quizId: string; occurredAt: Date }
  | { type: "team.registration_cancelled"; quizId: string; occurredAt: Date }
  | { type: "quiz.details_updated"; quizId: string; occurredAt: Date }
  | { type: "team.roster_changed"; quizId: string; occurredAt: Date }
  | { type: "team.payment_changed"; quizId: string; occurredAt: Date }
  | { type: "quiz.cancelled"; quizId: string; occurredAt: Date }
  | { type: "asset.uploaded"; url: string; category: "flyer" | "feedback"; occurredAt: Date };
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/events.test.ts`  
Expected: PASS

---

### Task 2: Core Storage Pruning Service (`src/lib/storagePruner.ts`)

**Files:**

- Create: `src/lib/storagePruner.ts`
- Test: `tests/unit/storagePruner.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface PruneSummary {
    examined: number;
    referenced: number;
    deleted: number;
    reclaimedBytes: number;
    durationMs: number;
    mode: "local" | "blob";
  }

  export function extractStorageKey(urlOrPath: string): string | null;

  export async function getReferencedStorageKeys(prismaClient?: PrismaClient): Promise<Set<string>>;

  export async function pruneOrphanedUploads(options?: {
    dryRun?: boolean;
    force?: boolean;
    ttlMs?: number;
    prismaClient?: any;
    now?: number;
  }): Promise<PruneSummary>;
  ```

- [x] **Step 1: Write the failing tests**

Create `tests/unit/storagePruner.test.ts` covering:

1. `extractStorageKey`:
   - local `/uploads/flyer.jpg` -> `"uploads/flyer.jpg"`
   - local `/uploads/feedback/screen.png` -> `"uploads/feedback/screen.png"`
   - blob `https://abc.public.blob.vercel-storage.com/uploads/flyer.jpg` -> `"uploads/flyer.jpg"`
   - blob `https://abc.public.blob.vercel-storage.com/uploads/feedback/screen.png` -> `"uploads/feedback/screen.png"`
   - external `https://images.unsplash.com/photo-123` -> `null`
2. `getReferencedStorageKeys`: queries `prisma.quiz` and `prisma.feedback`, returns set containing normalized keys.
3. `pruneOrphanedUploads` in local mode:
   - Skips unreferenced files younger than 24h (`ttlMs`).
   - Retains referenced files regardless of age.
   - Deletes unreferenced files older than 24h when `dryRun: false`.
   - Records deleted files and reclaimed bytes without unlinking when `dryRun: true`.
   - Bypasses 24h retention when `force: true`.
4. `pruneOrphanedUploads` in blob mode:
   - Lists blobs via `@vercel/blob`'s `list()`, handles pagination via `cursor`.
   - Deletes matching unreferenced blobs older than 24h via `del()`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/storagePruner.test.ts`  
Expected: FAIL (`Cannot find module '@/lib/storagePruner'`)

- [x] **Step 3: Implement `src/lib/storagePruner.ts`**

Implement `extractStorageKey`, `getReferencedStorageKeys`, and `pruneOrphanedUploads`:

- Use `process.env.BLOB_READ_WRITE_TOKEN` to determine mode (`"blob"` vs `"local"`).
- Default `ttlMs` to `24 * 60 * 60 * 1000` (24 hours).
- Local mode: use Node `fs/promises` (`readdir`, `stat`, `unlink`). Scan both `public/uploads` and `public/uploads/feedback`.
- Blob mode: use `@vercel/blob` (`list`, `del`), looping while `response.hasMore` and passing `cursor`.
- Track `examined`, `referenced`, `deleted`, `reclaimedBytes`, `durationMs`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/storagePruner.test.ts`  
Expected: PASS

---

### Task 3: Event Subscriber & Throttling (`src/lib/storagePrunerSubscriber.ts`)

**Files:**

- Create: `src/lib/storagePrunerSubscriber.ts`
- Test: `tests/unit/storagePrunerSubscriber.test.ts`

**Interfaces:**

- Consumes: `domainEvents` from `@/lib/events`, `pruneOrphanedUploads` from `@/lib/storagePruner`
- Produces:

  ```typescript
  export function registerStoragePrunerSubscriber(options?: {
    cooldownMs?: number;
    bus?: DomainEventBus;
  }): () => void;
  ```

- [x] **Step 1: Write the failing tests**

Create `tests/unit/storagePrunerSubscriber.test.ts`:

1. Subscribes to `asset.uploaded` on the event bus.
2. When `asset.uploaded` is emitted, triggers `pruneOrphanedUploads` if cooldown has passed.
3. Sets `(globalThis as any).__beQuizLastPruneTimestamp`.
4. When a second `asset.uploaded` event is emitted before cooldown expires, does NOT trigger `pruneOrphanedUploads`.
5. Unsubscribe function cleanly removes the handler from the bus.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/storagePrunerSubscriber.test.ts`  
Expected: FAIL (`Cannot find module '@/lib/storagePrunerSubscriber'`)

- [x] **Step 3: Implement `src/lib/storagePrunerSubscriber.ts`**

Implement `registerStoragePrunerSubscriber`:

- Default `cooldownMs = 24 * 60 * 60 * 1000`.
- Store and check timestamp on `(globalThis as any).__beQuizLastPruneTimestamp`.
- On trigger, invoke `pruneOrphanedUploads({ dryRun: false })` and catch any errors to prevent unhandled rejections.
- Return unsubscribe cleanup callback.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/storagePrunerSubscriber.test.ts`  
Expected: PASS

---

### Task 4: Server Startup Registration & Upload Event Emission

**Files:**

- Modify: `src/instrumentation.ts:1-9`
- Modify: `src/lib/storage.ts:1-31`
- Modify: `src/lib/feedbackStorage.ts:1-35`
- Test: `tests/instrumentation.test.ts`
- Test: `tests/api/upload-flyer.test.ts`
- Test: `tests/services/feedbackActions.test.ts`

**Interfaces:**

- Consumes: `registerStoragePrunerSubscriber` from `@/lib/storagePrunerSubscriber`, `domainEvents` from `@/lib/events`

- [x] **Step 1: Write the failing tests**

1. In `tests/instrumentation.test.ts`, verify that `registerStoragePrunerSubscriber` is called when `NEXT_RUNTIME === "nodejs"`.
2. In `tests/api/upload-flyer.test.ts`, verify that `domainEvents.emit` is invoked with `{ type: "asset.uploaded", category: "flyer" }` after successful flyer upload.
3. In `tests/services/feedbackActions.test.ts`, verify that `domainEvents.emit` is invoked with `{ type: "asset.uploaded", category: "feedback" }` after successful feedback screenshot upload.

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/instrumentation.test.ts tests/api/upload-flyer.test.ts tests/services/feedbackActions.test.ts`  
Expected: FAIL (event not emitted / subscriber not registered in instrumentation).

- [x] **Step 3: Update `src/instrumentation.ts`, `src/lib/storage.ts`, and `src/lib/feedbackStorage.ts`**

1. In `src/instrumentation.ts`:
   ```typescript
   export async function register() {
     if (process.env.NEXT_RUNTIME === "nodejs") {
       const { registerStoragePrunerSubscriber } = await import("@/lib/storagePrunerSubscriber");
       registerStoragePrunerSubscriber();

       const { getCapabilities } = await import("@/features/capabilities");
       if (getCapabilities().sharedGoogleCalendar) {
         const { registerSharedCalendarSubscriber } = await import("@/features/calendar");
         registerSharedCalendarSubscriber();
       }
     }
   }
   ```
2. In `src/lib/storage.ts`: after saving flyer buffer, emit `asset.uploaded` via `domainEvents.emit` before returning URL.
3. In `src/lib/feedbackStorage.ts`: after saving screenshot buffer, emit `asset.uploaded` via `domainEvents.emit` before returning URL.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/instrumentation.test.ts tests/api/upload-flyer.test.ts tests/services/feedbackActions.test.ts`  
Expected: PASS

---

### Task 5: Standalone CLI Script Refactor (`scripts/prune-uploads.ts`)

**Files:**

- Modify: `scripts/prune-uploads.ts:1-73`
- Test: `tests/unit/pruneCli.test.ts`

**Interfaces:**

- Consumes: `pruneOrphanedUploads` from `@/lib/storagePruner`

- [x] **Step 1: Write the failing tests**

Create `tests/unit/pruneCli.test.ts`:

- Test parsing of CLI arguments `--dry-run` and `--force`.
- Verify that `--dry-run` passes `dryRun: true` to `pruneOrphanedUploads`.
- Verify that `--force` passes `force: true` to `pruneOrphanedUploads`.
- Verify default execution passes `dryRun: false` and `force: false`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pruneCli.test.ts`  
Expected: FAIL

- [x] **Step 3: Refactor `scripts/prune-uploads.ts`**

Refactor `scripts/prune-uploads.ts` to:

- Parse `process.argv` for `--dry-run` and `--force`.
- Call `pruneOrphanedUploads({ dryRun, force })`.
- Print a clean, formatted terminal summary:

  ```
  Prune Uploads Summary:
  - Mode: local | blob
  - Files examined: X
  - Referenced in DB: Y
  - Files deleted: Z (or "Would delete" in dry-run)
  - Space reclaimed: A KB (~B MB)
  - Execution time: C ms
  ```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pruneCli.test.ts`  
Expected: PASS

- [x] **Step 5: Execute manual dry-run verification**

Run: `npm run prune-uploads -- --dry-run`  
Expected: Prints clean summary of existing local storage without errors.

---

### Task 6: Full Verification & Documentation Synchronization

**Files:**

- Modify: `docs/roadmap.md`
- Documentation: `docs/infrastructure/overview.md`, `DEPLOYMENT.md`

- [x] **Step 1: Update documentation**
  - Update `docs/infrastructure/overview.md` to document the opportunistic garbage collection and 24h TTL.
  - Update root `DEPLOYMENT.md` to note `npm run prune-uploads` CLI maintenance options.
  - Update `docs/roadmap.md` to link to this implementation plan (`[ ] Plan Ready: docs/superpowers/plans/2026-11-07-opportunistic-storage-garbage-collection.md`).

- [x] **Step 2: Run full quality and test suite**
      Run: `npm run check:all`
      Expected: All checks pass (typecheck, tests, lint, format, audit-ci, secretlint).
