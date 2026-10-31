import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { CapabilitiesProvider } from "../../src/features/capabilities";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("QuizDetailClient Declined Players Integration", () => {
  const quizWithDeclined = {
    id: "quiz-1",
    title: "Pubquiz",
    startsAt: new Date("2026-11-20T20:00:00Z"),
    location: "Gent",
    durationMinutes: 180,
    entryFee: null,
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [
        { memberId: "m1", status: "ATTENDING", queuedSince: new Date(1000), member: { id: "m1", name: "Attending Alice" } },
        { memberId: "m2", status: "DECLINED", queuedSince: null, member: { id: "m2", name: "Declined Dave" } },
      ],
    },
  };

  const defaultCaps = { vision: false, icalExport: false, whatsappShare: false, emailRegistration: false };

  it("initializes and renders declined members from quiz team data", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient quiz={quizWithDeclined} currentMemberId="m1" currentMemberName="Attending Alice" />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Attending Alice");
    expect(html).toContain("Afgemeld (1)");
    expect(html).toContain("Declined Dave");
  });
});
