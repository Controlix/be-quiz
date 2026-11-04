import { EventBus } from "./bus";
import type { DomainEventBus } from "./types";

export * from "./types";
export * from "./bus";

const globalForEvents = globalThis as unknown as {
  __domainEvents__: DomainEventBus | undefined;
};

export const domainEvents: DomainEventBus =
  globalForEvents.__domainEvents__ ?? (globalForEvents.__domainEvents__ = new EventBus());
