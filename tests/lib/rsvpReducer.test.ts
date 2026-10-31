import { describe, it, expect } from "vitest";
import {
  rsvpReducer,
  deriveCurrentUserStatus,
  deriveLineupRosters,
  ClientRsvp,
} from "../../src/lib/rsvpReducer";

describe("rsvpReducer & State Derivations", () => {
  const initial: ClientRsvp[] = [
    {
      memberId: "admin-1",
      name: "Admin Alex",
      status: "ATTENDING",
      queuedSince: new Date(1000),
    },
    {
      memberId: "user-2",
      name: "User Bob",
      status: "DECLINED",
      queuedSince: null,
    },
  ];

  it("derives current user status correctly", () => {
    expect(deriveCurrentUserStatus(initial, "admin-1")).toBe("ATTENDING");
    expect(deriveCurrentUserStatus(initial, "user-2")).toBe("DECLINED");
    expect(deriveCurrentUserStatus(initial, "unknown")).toBeNull();
  });

  it("derives active attendees and declined members cleanly", () => {
    const { attendees, declined } = deriveLineupRosters(initial, "admin-1");
    expect(attendees.length).toBe(1);
    expect(attendees[0].name).toBe("Admin Alex (jij)");
    expect(declined.length).toBe(1);
    expect(declined[0].name).toBe("User Bob");
  });

  // Review Focus #1: Self-override decline
  it("synchronizes status when an admin overrides their own RSVP to declined", () => {
    const nextState = rsvpReducer(initial, {
      type: "ADMIN_OVERRIDE_DECLINE",
      memberId: "admin-1",
    });

    expect(deriveCurrentUserStatus(nextState, "admin-1")).toBe("DECLINED");
    const { attendees, declined } = deriveLineupRosters(nextState, "admin-1");
    expect(attendees.length).toBe(0);
    expect(declined.length).toBe(2);
    expect(declined.some((d) => d.id === "admin-1")).toBe(true);
  });

  // Review Focus #2: Self-override attend
  it("synchronizes status when an admin re-enrolls themselves to attending", () => {
    const declinedState = rsvpReducer(initial, {
      type: "ADMIN_OVERRIDE_DECLINE",
      memberId: "admin-1",
    });

    const attendState = rsvpReducer(declinedState, {
      type: "ADMIN_OVERRIDE_ATTEND",
      memberId: "admin-1",
    });

    expect(deriveCurrentUserStatus(attendState, "admin-1")).toBe("ATTENDING");
    const { attendees, declined } = deriveLineupRosters(attendState, "admin-1");
    expect(attendees.length).toBe(1);
    expect(attendees[0].id).toBe("admin-1");
    expect(declined.length).toBe(1);
    expect(declined[0].id).toBe("user-2");
  });

  // Review Focus #4: First-time RSVP
  it("adds new member entry when RSVPing for the first time", () => {
    const nextState = rsvpReducer(initial, {
      type: "USER_RSVP",
      memberId: "new-user",
      name: "Newbie",
      status: "ATTENDING",
    });

    expect(deriveCurrentUserStatus(nextState, "new-user")).toBe("ATTENDING");
    const { attendees } = deriveLineupRosters(nextState, "new-user");
    expect(attendees.length).toBe(2);
  });

  // Review Focus #3: Reordering with declined members
  it("preserves declined members untouched when reordering active attendees", () => {
    const stateWithThree: ClientRsvp[] = [
      {
        memberId: "m1",
        name: "Member 1",
        status: "ATTENDING",
        queuedSince: new Date(1000),
      },
      {
        memberId: "m2",
        name: "Member 2",
        status: "ATTENDING",
        queuedSince: new Date(2000),
      },
      {
        memberId: "m3",
        name: "Member 3",
        status: "DECLINED",
        queuedSince: null,
      },
    ];

    const reordered = rsvpReducer(stateWithThree, {
      type: "ADMIN_REORDER",
      sourceIndex: 1,
      destinationIndex: 0,
    });

    const { attendees, declined } = deriveLineupRosters(reordered, "m1");
    expect(attendees.length).toBe(2);
    expect(attendees[0].id).toBe("m2");
    expect(attendees[1].id).toBe("m1");
    expect(declined.length).toBe(1);
    expect(declined[0].id).toBe("m3");
  });
});
