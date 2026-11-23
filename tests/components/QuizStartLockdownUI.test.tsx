import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { CapabilitiesProvider } from "../../src/features/capabilities";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const caps = {
  vision: false,
  icalExport: true,
  whatsappShare: true,
  emailRegistration: true,
  sharedGoogleCalendar: false,
};

function makeQuiz(overrides: Partial<any> = {}) {
  return {
    id: "quiz-1",
    title: "Lockdown Quiz",
    startsAt: new Date(Date.now() - 3600000), // started 1h ago
    durationMinutes: 180,
    location: "Gent",
    status: "OPEN",
    entryFee: null,
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 2,
      registeredAt: null,
      paidAt: null,
      rsvps: [
        {
          id: "rsvp-1",
          memberId: "user-1",
          status: "ATTENDING",
          queuedSince: new Date(1000),
          member: { id: "user-1", name: "Alice" },
        },
        {
          id: "rsvp-guest-active",
          memberId: null,
          guestName: "ActiveGast",
          invitedById: "user-1",
          invitedBy: { id: "user-1", name: "Alice" },
          status: "ATTENDING",
          queuedSince: new Date(1500),
        },
        {
          id: "rsvp-guest-reserve",
          memberId: null,
          guestName: "ReserveGast",
          invitedById: "user-1",
          invitedBy: { id: "user-1", name: "Alice" },
          status: "ATTENDING",
          queuedSince: new Date(2000),
        },
      ],
    },
    ...overrides,
  };
}

describe("Quiz Start Lockdown UI", () => {
  // Review Focus #4: Active + reserve guest Verwijderen hidden + ActionToolbar locked + RSVP hidden for USER
  it("hides personal RSVP buttons, guest removal (both active and reserve), and registration/payment toggles for USER on started quiz while keeping WhatsApp & Calendar", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={makeQuiz()}
          currentMemberId="user-1"
          currentMemberName="Alice"
          isAdmin={false}
        />
      </CapabilitiesProvider>
    );

    expect(html).not.toContain("Ik doe mee");
    expect(html).not.toContain("Kan niet");
    expect(html).toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain(
      "De inschrijvingen zijn gesloten. Wijzigingen kunnen enkel door een beheerder worden doorgevoerd."
    );
    expect(html).not.toContain("+ Gast toevoegen");
    expect(html).not.toContain("Verwijderen");
    expect(html).toContain("Status vergrendeld na starttijd");
    expect(html).not.toContain("Mail verzonden? Bevestig registratie");
    expect(html).not.toContain("Schrijf Ploeg In (Open Mail)");
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Niet betaald/);
    expect(html).toContain("Niet betaald");
    expect(html).toContain("WhatsApp");
    expect(html).toContain("In Agenda");
  });

  // Review Focus #3: Player Dual-Identity for ADMIN on started quiz
  it("hides personal RSVP buttons for ADMIN on started quiz with admin override banner, while keeping admin controls active", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={makeQuiz()}
          currentMemberId="admin-1"
          currentMemberName="Admin Marc"
          isAdmin={true}
          allMembers={[{ id: "user-2", name: "Bob" }]}
        />
      </CapabilitiesProvider>
    );

    expect(html).not.toContain("Ik doe mee");
    expect(html).not.toContain("Kan niet");
    expect(html).toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain(
      "Inschrijvingen gesloten. Als beheerder kun je hieronder spelers handmatig aanpassen of wisselen."
    );
    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("+ Teamlid toevoegen");
    expect(html).toContain("Afzeggen");
    expect(html).toContain("Mail verzonden? Bevestig registratie");
    expect(html).toMatch(
      /<button[^>]*>(?:(?!<\/button>)[\s\S])*Niet betaald(?:(?!<\/button>)[\s\S])*<\/button>/
    );
  });

  it("renders interactive personal RSVP buttons for USER on a future OPEN quiz", () => {
    const futureQuiz = makeQuiz({ startsAt: new Date(Date.now() + 86400000) });
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={futureQuiz}
          currentMemberId="user-1"
          currentMemberName="Alice"
          isAdmin={false}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Ik doe mee");
    expect(html).toContain("Kan niet");
    expect(html).not.toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("Verwijderen");
  });

  // Review Focus #5: Post-quiz rating widget remains active when concluded
  it("keeps QuizRatingWidget interactive for eligible players on a concluded locked quiz", () => {
    const concludedQuiz = makeQuiz({ startsAt: new Date(Date.now() - 86400000) });
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient
          quiz={concludedQuiz}
          currentMemberId="user-1"
          currentMemberName="Alice"
          isAdmin={false}
          initialRatingSummary={{ average: 4, count: 1, totalEligible: 1, userScore: 4 }}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Quiz gestart — opstelling definitief");
    expect(html).toContain("Hoe was deze quiz?");
  });
});
