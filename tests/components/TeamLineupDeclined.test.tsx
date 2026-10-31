import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamLineup } from "../../src/components/TeamLineup";

describe("TeamLineup Declined Players Rendering", () => {
  const dummyAttendees = [
    { id: "1", name: "Alice", queuedSince: new Date(1000) },
  ];

  // Review Focus #5: Zero declined players
  it("does not render the Afgemeld section when declinedMembers is empty or omitted", () => {
    const html = renderToStaticMarkup(
      <TeamLineup attendees={dummyAttendees} maxTeamSize={4} />
    );
    expect(html).not.toContain("Afgemeld");
  });

  it("renders declined member chips with ✕ when declinedMembers are provided", () => {
    const declined = [
      { id: "d1", name: "Bob" },
      { id: "d2", name: "Charlie" },
    ];
    const html = renderToStaticMarkup(
      <TeamLineup attendees={dummyAttendees} maxTeamSize={4} declinedMembers={declined} />
    );
    expect(html).toContain("Afgemeld (2)");
    expect(html).toContain("Bob");
    expect(html).toContain("Charlie");
    expect(html).not.toContain("+ Aanmelden");
  });

  it("renders '+ Aanmelden' buttons on chips when user is admin", () => {
    const declined = [{ id: "d1", name: "Bob" }];
    const html = renderToStaticMarkup(
      <TeamLineup
        attendees={dummyAttendees}
        maxTeamSize={4}
        declinedMembers={declined}
        isAdmin={true}
        onAdminOverrideAttend={() => {}}
      />
    );
    expect(html).toContain("+ Aanmelden");
  });
});
