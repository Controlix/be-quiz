export interface ClientRsvp {
  id: string;
  memberId?: string | null;
  guestName?: string | null;
  invitedById?: string | null;
  invitedByName?: string | null;
  name: string;
  isGuest?: boolean;
  status: "ATTENDING" | "DECLINED";
  queuedSince: Date | null;
}

export type RsvpAction =
  | { type: "USER_RSVP"; memberId: string; name: string; status: "ATTENDING" | "DECLINED" }
  | { type: "ADD_GUEST"; id: string; guestName: string; invitedById: string; invitedByName: string }
  | { type: "REMOVE_GUEST"; id: string }
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
          id: action.memberId,
          memberId: action.memberId,
          name: action.name,
          isGuest: false,
          status: action.status,
          queuedSince: action.status === "ATTENDING" ? new Date() : null,
        },
      ];
    }

    case "ADD_GUEST": {
      return [
        ...state,
        {
          id: action.id,
          memberId: null,
          guestName: action.guestName,
          invitedById: action.invitedById,
          invitedByName: action.invitedByName,
          name: action.guestName,
          isGuest: true,
          status: "ATTENDING",
          queuedSince: new Date(),
        },
      ];
    }

    case "REMOVE_GUEST": {
      return state.filter((r) => r.id !== action.id);
    }

    case "ADMIN_OVERRIDE_DECLINE": {
      return state.map((r) =>
        r.memberId === action.memberId ? { ...r, status: "DECLINED", queuedSince: null } : r
      );
    }

    case "ADMIN_OVERRIDE_ATTEND": {
      return state.map((r) =>
        r.memberId === action.memberId ? { ...r, status: "ATTENDING", queuedSince: new Date() } : r
      );
    }

    case "ADMIN_REORDER": {
      const attending = state
        .filter((r) => r.status === "ATTENDING")
        .sort(
          (a, b) => new Date(a.queuedSince || 0).getTime() - new Date(b.queuedSince || 0).getTime()
        );

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
        const key = r.id || r.memberId || "";
        reorderedMap.set(key, new Date(baseTime + idx * 1000));
      });

      return state.map((r) => {
        const key = r.id || r.memberId || "";
        if (reorderedMap.has(key)) {
          return { ...r, queuedSince: reorderedMap.get(key)! };
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

export interface DerivedLineupMember {
  id: string;
  memberId: string | null;
  name: string;
  queuedSince: Date;
  isGuest: boolean;
  guestName?: string | null;
  invitedById?: string | null;
  invitedByName?: string | null;
}

export interface DerivedDeclinedMember {
  id: string;
  memberId: string;
  name: string;
}

export function deriveLineupRosters(
  rsvps: ClientRsvp[],
  currentMemberId: string
): {
  attendees: DerivedLineupMember[];
  declined: DerivedDeclinedMember[];
} {
  const attendees: DerivedLineupMember[] = rsvps
    .filter((r) => r.status === "ATTENDING")
    .sort((a, b) => new Date(a.queuedSince || 0).getTime() - new Date(b.queuedSince || 0).getTime())
    .map((r) => {
      const isSelf = r.memberId === currentMemberId;
      const displayName = isSelf ? `${r.name.replace(" (jij)", "")} (jij)` : r.name;
      return {
        id: r.id || r.memberId || "",
        memberId: r.memberId ?? null,
        name: displayName,
        queuedSince: r.queuedSince || new Date(),
        isGuest: Boolean(r.isGuest),
        guestName: r.guestName ?? null,
        invitedById: r.invitedById ?? null,
        invitedByName: r.invitedByName ?? null,
      };
    });

  const declined: DerivedDeclinedMember[] = rsvps
    .filter((r) => r.status === "DECLINED" && Boolean(r.memberId))
    .map((r) => ({
      id: r.id || r.memberId || "",
      memberId: r.memberId!,
      name: r.memberId === currentMemberId ? `${r.name.replace(" (jij)", "")} (jij)` : r.name,
    }));

  return { attendees, declined };
}
