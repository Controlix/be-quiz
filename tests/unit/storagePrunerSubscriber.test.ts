import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "@/lib/events/bus";
import * as storagePrunerModule from "@/lib/storagePruner";
import { registerStoragePrunerSubscriber } from "@/lib/storagePrunerSubscriber";

describe("storagePrunerSubscriber", () => {
  let bus: EventBus;
  const originalTimestamp = (globalThis as any).__beQuizLastPruneTimestamp;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).__beQuizLastPruneTimestamp;
    bus = new EventBus();
  });

  afterEach(() => {
    if (originalTimestamp !== undefined) {
      (globalThis as any).__beQuizLastPruneTimestamp = originalTimestamp;
    } else {
      delete (globalThis as any).__beQuizLastPruneTimestamp;
    }
  });

  it("subscribes to asset.uploaded and calls pruneOrphanedUploads when cooldown has elapsed", async () => {
    const pruneSpy = vi.spyOn(storagePrunerModule, "pruneOrphanedUploads").mockResolvedValue({
      examined: 1,
      referenced: 0,
      deleted: 1,
      reclaimedBytes: 1000,
      durationMs: 5,
      mode: "local",
    });

    const unsubscribe = registerStoragePrunerSubscriber({
      bus,
      cooldownMs: 10_000,
    });

    bus.emit({
      type: "asset.uploaded",
      url: "/uploads/new-flyer.jpg",
      category: "flyer",
      occurredAt: new Date(),
    });

    // Wait for any microtasks
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(pruneSpy).toHaveBeenCalledTimes(1);
    expect(pruneSpy).toHaveBeenCalledWith({ dryRun: false });
    expect((globalThis as any).__beQuizLastPruneTimestamp).toBeDefined();

    unsubscribe();
  });

  it("throttles consecutive calls within the cooldown window", async () => {
    const pruneSpy = vi.spyOn(storagePrunerModule, "pruneOrphanedUploads").mockResolvedValue({
      examined: 1,
      referenced: 0,
      deleted: 1,
      reclaimedBytes: 1000,
      durationMs: 5,
      mode: "local",
    });

    const unsubscribe = registerStoragePrunerSubscriber({
      bus,
      cooldownMs: 60_000,
    });

    // First event: should trigger
    bus.emit({
      type: "asset.uploaded",
      url: "/uploads/first.jpg",
      category: "flyer",
      occurredAt: new Date(),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pruneSpy).toHaveBeenCalledTimes(1);

    // Second event immediately after: should be throttled
    bus.emit({
      type: "asset.uploaded",
      url: "/uploads/second.jpg",
      category: "flyer",
      occurredAt: new Date(),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pruneSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("unsubscribes cleanly so subsequent events do not trigger pruning", async () => {
    const pruneSpy = vi.spyOn(storagePrunerModule, "pruneOrphanedUploads").mockResolvedValue({
      examined: 0,
      referenced: 0,
      deleted: 0,
      reclaimedBytes: 0,
      durationMs: 1,
      mode: "local",
    });

    const unsubscribe = registerStoragePrunerSubscriber({
      bus,
      cooldownMs: 10_000,
    });

    unsubscribe();

    bus.emit({
      type: "asset.uploaded",
      url: "/uploads/after-unsub.jpg",
      category: "flyer",
      occurredAt: new Date(),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pruneSpy).not.toHaveBeenCalled();
  });
});
