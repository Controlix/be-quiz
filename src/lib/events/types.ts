export type DomainEvent =
  | { type: "team.registered"; quizId: string; occurredAt: Date }
  | { type: "team.registration_cancelled"; quizId: string; occurredAt: Date }
  | { type: "quiz.details_updated"; quizId: string; occurredAt: Date }
  | { type: "team.roster_changed"; quizId: string; occurredAt: Date }
  | { type: "team.payment_changed"; quizId: string; occurredAt: Date }
  | { type: "quiz.cancelled"; quizId: string; occurredAt: Date };

export interface DomainEventBus {
  emit(event: DomainEvent): void;
  subscribe<T extends DomainEvent["type"]>(
    type: T,
    handler: (event: Extract<DomainEvent, { type: T }>) => Promise<void> | void
  ): () => void;
  clear(): void;
}
