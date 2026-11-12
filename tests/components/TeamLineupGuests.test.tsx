import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamLineup } from "../../src/components/TeamLineup";

describe("TeamLineup with Guest Players", () => {
  const attendees = [
    {
      id: "rsvp-1",
      memberId: "m1",
      name: "Alice",
      queuedSince: new Date(1000),
      isGuest: false,
    },
    {
      id: "rsvp-2",
      memberId: null,
      name: "Sarah",
      guestName: "Sarah",
      invitedById: "m1",
      invitedByName: "Alice",
      queuedSince: new Date(2000),
      isGuest: true,
    },
  ];

  it("renders guest name and 'Gast van Alice' badge", () => {
    const html = renderToStaticMarkup(
      <TeamLineup attendees={attendees as any} maxTeamSize={4} currentMemberId="m1" />
    );

    expect(html).toContain("Alice");
    expect(html).toContain("Sarah");
    expect(html).toContain("Gast van Alice");
  });

  it("renders 'Verwijderen' button when current user is the inviter", () => {
    const html = renderToStaticMarkup(
      <TeamLineup attendees={attendees as any} maxTeamSize={4} currentMemberId="m1" />
    );

    expect(html).toContain("Verwijderen");
  });

  it("renders 'Verwijderen' button when current user is an admin even if not inviter", () => {
    const html = renderToStaticMarkup(
      <TeamLineup
        attendees={attendees as any}
        maxTeamSize={4}
        currentMemberId="other-admin"
        isAdmin={true}
      />
    );

    expect(html).toContain("Verwijderen");
  });

  it("does NOT render 'Verwijderen' button for a non-admin non-inviter teammate", () => {
    const html = renderToStaticMarkup(
      <TeamLineup
        attendees={attendees as any}
        maxTeamSize={4}
        currentMemberId="m2"
        isAdmin={false}
      />
    );

    expect(html).not.toContain("Verwijderen");
  });

  it("passes member.memberId to onAdminOverrideAttend when admin clicks + Aanmelden", () => {
    const declined = [
      {
        id: "rsvp-declined-1",
        memberId: "actual-member-id",
        name: "Bob",
      },
    ];

    const html = renderToStaticMarkup(
      <TeamLineup
        attendees={attendees as any}
        maxTeamSize={4}
        declinedMembers={declined as any}
        isAdmin={true}
        onAdminOverrideAttend={() => {}}
      />
    );

    expect(html).toContain("+ Aanmelden");
  });
});
