import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { deriveUnrespondedMembers } from "../../src/lib/rsvpReducer";
import { CapabilitiesProvider } from "../../src/features/capabilities";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("QuizDetailClient Admin Member Enrollment Trigger", () => {
  const baseQuiz = {
    id: "quiz-1",
    title: "Pubquiz",
    startsAt: new Date(Date.now() + 86400000),
    location: "Gent",
    durationMinutes: 180,
    entryFee: null,
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [],
    },
  };

  const defaultCaps = {
    vision: false,
    icalExport: false,
    whatsappShare: false,
    emailRegistration: false,
    sharedGoogleCalendar: false,
  };

  it("renders + Teamlid toevoegen beside + Gast toevoegen for admins", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={baseQuiz}
          currentMemberId="admin-1"
          currentMemberName="Admin"
          isAdmin={true}
          allMembers={[{ id: "m2", name: "Charlie" }]}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("+ Teamlid toevoegen");
  });

  it("does not render + Teamlid toevoegen for regular non-admin users", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={baseQuiz}
          currentMemberId="user-1"
          currentMemberName="User"
          isAdmin={false}
          allMembers={[{ id: "m2", name: "Charlie" }]}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("+ Gast toevoegen");
    expect(html).not.toContain("+ Teamlid toevoegen");
  });

  it("renders cleanly for admins when allMembers prop is omitted", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={baseQuiz}
          currentMemberId="admin-1"
          currentMemberName="Admin"
          isAdmin={true}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("+ Gast toevoegen");
    expect(html).toContain("+ Teamlid toevoegen");
  });

  it("excludes the current logged-in admin from the derived enrollable members", () => {
    const allMembers = [
      { id: "admin-1", name: "Admin Marc" },
      { id: "user-2", name: "Teammate Emma" },
    ];
    const enrollable = deriveUnrespondedMembers(allMembers, [], "admin-1");

    expect(enrollable).toEqual([{ id: "user-2", name: "Teammate Emma" }]);
  });
});
