export interface ClientRsvp {
  memberId: string;
  name: string;
  status: "ATTENDING" | "DECLINED";
  queuedSince: Date | null;
}

export type RsvpAction =
  | { type: "USER_RSVP"; memberId: string; name: string; status: "ATTENDING" | "DECLINED" }
  | { type: "ADMIN_OVERRIDE_DECLINE"; memberId: string }
  | { type: "ADMIN_OVERRIDE_ATTEND"; memberId: string }
  | { type: "ADMIN_REORDER"; sourceIndex: number; destinationIndex: number };

export function rsvpReducer(state: ClientRsvp[], action: RsvpAction): ClientRsvp[] {
  switch (action.type) {
    case "USER_RSVP": {
      const existing = state.find((r) => r.memberId === action.memberId);
      if (existing) {
        return state.map((r) =>
          r.memberId === action.memberId
            ? {
                ...r,
                status: action.status,
                queuedSince: action.status === "ATTENDING" ? new Date() : null,
              }
            : r
        );
      }
      return [
        ...state,
        {
          memberId: action.memberId,
          name: action.name,
          status: action.status,
          queuedSince: action.status === "ATTENDING" ? new Date() : null,
        },
      ];
    }

    case "ADMIN_OVERRIDE_DECLINE": {
      return state.map((r) =>
        r.memberId === action.memberId
          ? { ...r, status: "DECLINED", queuedSince: null }
          : r
      );
    }

    case "ADMIN_OVERRIDE_ATTEND": {
      return state.map((r) =>
        r.memberId === action.memberId
          ? { ...r, status: "ATTENDING", queuedSince: new Date() }
          : r
      );
    }

    case "ADMIN_REORDER": {
      const attending = state
        .filter((r) => r.status === "ATTENDING")
        .sort((a, b) => new Date(a.queuedSince || 0).getTime() - new Date(b.queuedSince || 0).getTime());

      if (
        action.sourceIndex < 0 ||
        action.sourceIndex >= attending.length ||
        action.destinationIndex < 0 ||
        action.destinationIndex >= attending.length ||
        action.sourceIndex === action.destinationIndex
      ) {
        return state;
      }

      const reordered = [...attending];
      const [moved] = reordered.splice(action.sourceIndex, 1);
      reordered.splice(action.destinationIndex, 0, moved);

      const baseTime = Date.now() - 100000;
      const reorderedMap = new Map<string, Date>();
      reordered.forEach((r, idx) => {
        reorderedMap.set(r.memberId, new Date(baseTime + idx * 1000));
      });

      return state.map((r) => {
        if (reorderedMap.has(r.memberId)) {
          return { ...r, queuedSince: reorderedMap.get(r.memberId)! };
        }
        return r;
      });
    }

    default:
      return state;
  }
}

export function deriveCurrentUserStatus(
  rsvps: ClientRsvp[],
  currentMemberId: string
): "ATTENDING" | "DECLINED" | null {
  return rsvps.find((r) => r.memberId === currentMemberId)?.status || null;
}

export function deriveLineupRosters(
  rsvps: ClientRsvp[],
  currentMemberId: string
): {
  attendees: Array<{ id: string; name: string; queuedSince: Date }>;
  declined: Array<{ id: string; name: string }>;
} {
  const attendees = rsvps
    .filter((r) => r.status === "ATTENDING")
    .sort((a, b) => new Date(a.queuedSince || 0).getTime() - new Date(b.queuedSince || 0).getTime())
    .map((r) => ({
      id: r.memberId,
      name: r.memberId === currentMemberId ? `${r.name.replace(" (jij)", "")} (jij)` : r.name,
      queuedSince: r.queuedSince || new Date(),
    }));

  const declined = rsvps
    .filter((r) => r.status === "DECLINED")
    .map((r) => ({
      id: r.memberId,
      name: r.memberId === currentMemberId ? `${r.name.replace(" (jij)", "")} (jij)` : r.name,
    }));

  return { attendees, declined };
}
