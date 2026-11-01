import { DomainEvent, DomainEventBus } from "./types";

let nextServerAfterPromise: Promise<((fn: () => any) => void) | null> | null = null;

function getNextServerAfter(): Promise<((fn: () => any) => void) | null> {
  if (typeof window !== "undefined") {
    return Promise.resolve(null);
  }
  if (!nextServerAfterPromise) {
    nextServerAfterPromise = import("next/server")
      .then((mod) => (typeof mod.after === "function" ? mod.after : null))
      .catch(() => null);
  }
  return nextServerAfterPromise;
}

export class EventBus implements DomainEventBus {
  private handlers = new Map<string, Set<(event: any) => Promise<void> | void>>();

  subscribe<T extends DomainEvent["type"]>(
    type: T,
    handler: (event: Extract<DomainEvent, { type: T }>) => Promise<void> | void
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as (event: any) => Promise<void> | void);

    return () => {
      const current = this.handlers.get(type);
      if (current) {
        current.delete(handler as (event: any) => Promise<void> | void);
        if (current.size === 0) {
          this.handlers.delete(type);
        }
      }
    };
  }

  emit(event: DomainEvent): void {
    const subscribers = this.handlers.get(event.type);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    // Iterate over a snapshot in case a handler unsubscribes during emission
    for (const handler of Array.from(subscribers)) {
      try {
        const result = handler(event);
        if (result && typeof result.then === "function") {
          const promise = Promise.resolve(result).catch((err) => {
            console.error(
              `[DomainEventBus] Async handler error for event "${event.type}":`,
              err
            );
          });

          // Coordinate with Next.js after() when running in server environment
          if (typeof window === "undefined") {
            getNextServerAfter().then((after) => {
              if (after) {
                try {
                  after(() => promise);
                } catch {
                  // Outside active request context (tests, scripts, etc.)
                }
              }
            });
          }
        }
      } catch (err) {
        console.error(
          `[DomainEventBus] Sync handler error for event "${event.type}":`,
          err
        );
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
