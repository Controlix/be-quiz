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
      id: "admin-1",
      memberId: "admin-1",
      name: "Admin Alex",
      status: "ATTENDING",
      queuedSince: new Date(1000),
    },
    {
      id: "user-2",
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
        id: "m1",
        memberId: "m1",
        name: "Member 1",
        status: "ATTENDING",
        queuedSince: new Date(1000),
      },
      {
        id: "m2",
        memberId: "m2",
        name: "Member 2",
        status: "ATTENDING",
        queuedSince: new Date(2000),
      },
      {
        id: "m3",
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

  it("handles ADD_GUEST and REMOVE_GUEST actions", () => {
    const withGuest = rsvpReducer(initial, {
      type: "ADD_GUEST",
      id: "guest-rsvp-1",
      guestName: "Sarah",
      invitedById: "admin-1",
      invitedByName: "Admin Alex",
    });

    expect(withGuest.length).toBe(3);
    const guest = withGuest.find((r) => r.id === "guest-rsvp-1");
    expect(guest).toBeDefined();
    expect(guest?.isGuest).toBe(true);
    expect(guest?.guestName).toBe("Sarah");
    expect(guest?.invitedById).toBe("admin-1");
    expect(guest?.invitedByName).toBe("Admin Alex");
    expect(guest?.status).toBe("ATTENDING");
    expect(guest?.queuedSince).toBeInstanceOf(Date);

    // Test REMOVE_GUEST
    const afterRemoval = rsvpReducer(withGuest, {
      type: "REMOVE_GUEST",
      id: "guest-rsvp-1",
    });
    expect(afterRemoval.length).toBe(2);
    expect(afterRemoval.find((r) => r.id === "guest-rsvp-1")).toBeUndefined();
  });

  // Review Focus #1: Reordering with multiple guests without key collisions
  it("reorders active lineup with multiple guests without key collision", () => {
    const stateWithGuests: ClientRsvp[] = [
      {
        id: "rsvp-m1",
        memberId: "m1",
        name: "Member 1",
        isGuest: false,
        status: "ATTENDING",
        queuedSince: new Date(1000),
      },
      {
        id: "rsvp-g1",
        memberId: null,
        guestName: "Guest Sarah",
        invitedById: "m1",
        invitedByName: "Member 1",
        name: "Guest Sarah",
        isGuest: true,
        status: "ATTENDING",
        queuedSince: new Date(2000),
      },
      {
        id: "rsvp-g2",
        memberId: null,
        guestName: "Guest Mark",
        invitedById: "m1",
        invitedByName: "Member 1",
        name: "Guest Mark",
        isGuest: true,
        status: "ATTENDING",
        queuedSince: new Date(3000),
      },
    ];

    // Move Guest Mark (index 2) to top (index 0)
    const reordered = rsvpReducer(stateWithGuests, {
      type: "ADMIN_REORDER",
      sourceIndex: 2,
      destinationIndex: 0,
    });

    const { attendees } = deriveLineupRosters(reordered, "m1");
    expect(attendees.length).toBe(3);
    expect(attendees[0].id).toBe("rsvp-g2");
    expect(attendees[0].name).toBe("Guest Mark");
    expect(attendees[1].id).toBe("rsvp-m1");
    expect(attendees[2].id).toBe("rsvp-g1");
  });

  it("derives lineup rosters preserving guest metadata and memberId", () => {
    const stateWithGuest: ClientRsvp[] = [
      {
        id: "rsvp-1",
        memberId: "m1",
        name: "Alice",
        isGuest: false,
        status: "ATTENDING",
        queuedSince: new Date(1000),
      },
      {
        id: "rsvp-2",
        memberId: null,
        guestName: "Bob",
        invitedById: "m1",
        invitedByName: "Alice",
        name: "Bob",
        isGuest: true,
        status: "ATTENDING",
        queuedSince: new Date(2000),
      },
    ];

    const { attendees } = deriveLineupRosters(stateWithGuest, "m1");
    expect(attendees[0].memberId).toBe("m1");
    expect(attendees[0].isGuest).toBe(false);
    expect(attendees[1].memberId).toBeNull();
    expect(attendees[1].isGuest).toBe(true);
    expect(attendees[1].guestName).toBe("Bob");
    expect(attendees[1].invitedByName).toBe("Alice");
  });
});
