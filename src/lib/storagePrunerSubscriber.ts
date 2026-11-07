import { domainEvents as defaultBus } from "@/lib/events";
import type { DomainEventBus } from "@/lib/events/types";
import { pruneOrphanedUploads } from "@/lib/storagePruner";

export interface StoragePrunerSubscriberOptions {
  bus?: DomainEventBus;
  cooldownMs?: number;
}

const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const globalForPruner = globalThis as unknown as {
  __beQuizLastPruneTimestamp?: number;
  __storagePrunerSubscriberRegistered__?: boolean;
};

export function registerStoragePrunerSubscriber(
  options: StoragePrunerSubscriberOptions = {}
): () => void {
  const isDefaultBus = !options.bus;
  if (isDefaultBus && globalForPruner.__storagePrunerSubscriberRegistered__) {
    return () => {};
  }

  const bus = options.bus ?? defaultBus;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  if (isDefaultBus) {
    globalForPruner.__storagePrunerSubscriberRegistered__ = true;
  }

  const unsubscribe = bus.subscribe("asset.uploaded", async () => {
    const now = Date.now();
    const lastPrune = globalForPruner.__beQuizLastPruneTimestamp ?? 0;

    if (now - lastPrune < cooldownMs) {
      return; // Throttled
    }

    globalForPruner.__beQuizLastPruneTimestamp = now;

    try {
      await pruneOrphanedUploads({ dryRun: false });
    } catch (err) {
      console.error("[StoragePrunerSubscriber] Opportunistic prune failed:", err);
    }
  });

  return () => {
    if (isDefaultBus) {
      globalForPruner.__storagePrunerSubscriberRegistered__ = false;
    }
    unsubscribe();
  };
}
