import { EventBus } from "./bus";
import type { DomainEventBus } from "./types";

export * from "./types";
export * from "./bus";

export const domainEvents: DomainEventBus = new EventBus();
