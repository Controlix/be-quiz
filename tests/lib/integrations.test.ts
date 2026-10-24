import { describe, it, expect } from "vitest";
import { generateRegistrationMailto } from "../../src/lib/mailto";
import { generateIcsCalendar, generateGoogleCalendarUrl } from "../../src/lib/ical";
import { generateWhatsAppShareUrl } from "../../src/lib/whatsapp";

describe("Mailto & Calendar Integrations", () => {
  // Review Focus #5: Zero-RSVP registration email has no player names or counts
  it("generates mailto with team name only, excluding attendee names and player counts", () => {
    const quiz = {
      title: "Herfstquiz",
      startsAt: new Date("2026-11-14T19:00:00Z"),
      organizerEmail: "org@quiz.be",
    };
    const team = { name: "De Quizvrienden" };
    const url = generateRegistrationMailto(quiz, team, "Marc");
    expect(url.startsWith("mailto:org@quiz.be?")).toBe(true);
    expect(url).toContain("De%20Quizvrienden");
    expect(url).not.toContain("Spelers");
    expect(url).not.toContain("Aantal");
  });

  it("produces RFC 5545 compliant calendar output with CRLF endings", () => {
    const quiz = {
      id: "q1",
      title: "Test Quiz",
      startsAt: new Date("2026-11-14T19:00:00Z"),
      durationMinutes: 180,
      location: "Gent",
    };
    const team = { name: "Ploeg 1", paidAt: new Date() };
    const ics = generateIcsCalendar(quiz, team);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");
  });
});
