import { describe, it, expect } from "vitest";
import { formatGoogleCalendarPayload } from "@/features/calendar/shared/formatter";

describe("formatGoogleCalendarPayload", () => {
  it("formats title, location, and start/end with Europe/Brussels timezone", () => {
    const startsAt = new Date("2026-11-20T19:00:00.000Z");
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Den Dries Kwies",
        startsAt,
        durationMinutes: 180,
        location: "Kerkstraat 1, 9000 Gent",
      },
      lineup: ["Alice", "Bob", "Charlie", "Dave"],
      payment: { fee: "€20 / ploeg", isPaid: true, payerName: "Marc" },
      appUrl: "https://quiz.example.com",
    });

    expect(result.summary).toBe("Den Dries Kwies");
    expect(result.location).toBe("Kerkstraat 1, 9000 Gent");
    expect(result.start.timeZone).toBe("Europe/Brussels");
    expect(result.end.timeZone).toBe("Europe/Brussels");
    expect(result.start.dateTime).toBe(startsAt.toISOString());
    expect(new Date(result.end.dateTime).getTime()).toBe(startsAt.getTime() + 180 * 60000);
  });

  it("respects custom timeZone if provided in quiz object", () => {
    const startsAt = new Date("2026-11-20T19:00:00.000Z");
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Kwies",
        startsAt,
        durationMinutes: 60,
        location: "London",
        timeZone: "Europe/London",
      },
      lineup: ["Alice"],
      payment: { fee: "£10", isPaid: true },
    });

    expect(result.start.timeZone).toBe("Europe/London");
    expect(result.end.timeZone).toBe("Europe/London");
  });

  it("formats description with lineup, paid status and payer name", () => {
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Kwies",
        startsAt: new Date("2026-11-20T19:00:00Z"),
        durationMinutes: 120,
        location: "Gent",
      },
      lineup: ["Alice", "Bob"],
      payment: { fee: "€20", isPaid: true, payerName: "Marc" },
      appUrl: "https://quiz.example.com",
    });

    expect(result.description).toContain("Ploeg: Alice, Bob");
    expect(result.description).toContain("Inschrijvingsgeld: €20 (Betaald door Marc)");
    expect(result.description).toContain("https://quiz.example.com/quizzes/quiz-abc");
  });

  it("formats unpaid status correctly when not paid", () => {
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Kwies",
        startsAt: new Date("2026-11-20T19:00:00Z"),
        durationMinutes: 120,
        location: "Gent",
      },
      lineup: ["Alice"],
      payment: { fee: "€25", isPaid: false },
      appUrl: "https://quiz.example.com",
    });

    expect(result.description).toContain("Inschrijvingsgeld: €25 (Nog niet betaald)");
  });

  it("handles paid status without payerName", () => {
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-abc",
        title: "Kwies",
        startsAt: new Date("2026-11-20T19:00:00Z"),
        durationMinutes: 120,
        location: "Gent",
      },
      lineup: ["Alice"],
      payment: { fee: "€20", isPaid: true },
      appUrl: "https://quiz.example.com",
    });

    expect(result.description).toContain("Inschrijvingsgeld: €20 (Betaald)");
  });

  it("handles empty lineup and missing fee gracefully", () => {
    const result = formatGoogleCalendarPayload({
      quiz: {
        id: "quiz-empty",
        title: "Kwies Zonder Spelers",
        startsAt: new Date("2026-11-20T19:00:00Z"),
        durationMinutes: 120,
        location: "Gent",
      },
      lineup: [],
      payment: { fee: null, isPaid: false },
    });

    expect(result.description).toContain("Ploeg: Geen spelers");
    expect(result.description).toContain("Inschrijvingsgeld: Nog niet betaald");
  });
});
