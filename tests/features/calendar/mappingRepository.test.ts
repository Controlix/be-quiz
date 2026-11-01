import { describe, it, expect } from "vitest";
import { mappingRepository } from "@/features/calendar/shared/mappingRepository";

describe("CalendarEventMappingRepository", () => {
  it("returns null when no mapping exists for quizId", async () => {
    const result = await mappingRepository.findByQuizId(`quiz-nonexistent-${Date.now()}`);
    expect(result).toBeNull();
  });

  it("upserts and retrieves mapping by quizId", async () => {
    const quizId = `quiz-${Date.now()}-${Math.random()}`;
    await mappingRepository.upsertMapping(quizId, "gcal-event-999", "primary");
    const result = await mappingRepository.findByQuizId(quizId);

    expect(result).not.toBeNull();
    expect(result?.externalEventId).toBe("gcal-event-999");
    expect(result?.calendarId).toBe("primary");

    // Re-upsert updates existing mapping
    await mappingRepository.upsertMapping(quizId, "gcal-event-updated", "primary");
    const updated = await mappingRepository.findByQuizId(quizId);
    expect(updated?.externalEventId).toBe("gcal-event-updated");
  });

  it("deletes mapping cleanly by quizId", async () => {
    const quizId = `quiz-${Date.now()}-${Math.random()}`;
    await mappingRepository.upsertMapping(quizId, "gcal-event-999", "primary");
    await mappingRepository.deleteByQuizId(quizId);
    const result = await mappingRepository.findByQuizId(quizId);
    expect(result).toBeNull();
  });
});
