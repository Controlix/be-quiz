import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { CapabilitiesProvider } from "../../src/features/capabilities";

const caps = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: false,
  sharedGoogleCalendar: false,
};

function makeQuiz(overrides: Partial<any> = {}) {
  return {
    id: "quiz-edit-1",
    title: "Zomerquiz",
    startsAt: new Date(Date.now() + 86400000),
    durationMinutes: 180,
    location: "Zaal Centrum",
    organizerEmail: "org@quiz.be",
    entryFee: "€20 / ploeg",
    status: "OPEN",
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [],
    },
    ...overrides,
  };
}

describe("QuizDetailClient Edit Trigger Visibility", () => {
  it("shows Bewerken button for regular USER on an open future quiz", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient quiz={makeQuiz()} currentMemberId="user-1" isAdmin={false} />
      </CapabilitiesProvider>
    );
    expect(html).toContain("Bewerken");
  });

  it("hides Bewerken button for regular USER on started, CANCELLED, or ARCHIVED quizzes", () => {
    for (const locked of [
      makeQuiz({ startsAt: new Date(Date.now() - 60000) }),
      makeQuiz({ status: "CANCELLED" }),
      makeQuiz({ status: "ARCHIVED" }),
    ]) {
      const html = renderToStaticMarkup(
        <CapabilitiesProvider capabilities={caps}>
          <QuizDetailClient quiz={locked} currentMemberId="user-1" isAdmin={false} />
        </CapabilitiesProvider>
      );
      expect(html).not.toContain("Bewerken");
    }
  });

  it("keeps Bewerken button visible for ADMIN on started, CANCELLED, or ARCHIVED quizzes", () => {
    for (const locked of [
      makeQuiz({ startsAt: new Date(Date.now() - 60000) }),
      makeQuiz({ status: "CANCELLED" }),
      makeQuiz({ status: "ARCHIVED" }),
    ]) {
      const html = renderToStaticMarkup(
        <CapabilitiesProvider capabilities={caps}>
          <QuizDetailClient quiz={locked} currentMemberId="admin-1" isAdmin={true} />
        </CapabilitiesProvider>
      );
      expect(html).toContain("Bewerken");
    }
  });
});
