# Unified RSVP State & UI Consistency Design Specification

- **Date:** 2026-10-31
- **Status:** Approved / Ready to Plan
- **Roadmap Item:** Part 1, Item 1: Unified RSVP State Synchronization & UI Consistency
- **Authors:** AI Agent & Project Owner

---

## 1. Intent & The Why

In `QuizDetailClient.tsx`, participation status was split into three independent state variables:
- `attendees: LineupMember[]`
- `declinedMembers: DeclinedMember[]`
- `currentUserRsvp: "ATTENDING" | "DECLINED" | null`

When an admin declined a member (including themselves via *"Afzeggen"*) or re-enrolled someone (via *"+ Aanmelden"*), only the lineup arrays updated. `currentUserRsvp` was never synchronized, leaving the *"Jouw deelname"* buttons (*"Ik doe mee"* / *"Ik pas"*) showing a stale, contradictory status until a browser refresh.

To eliminate this class of synchronization bugs permanently, we model the RSVP state as a **single source of truth** managed by a pure reducer, from which all UI statuses and roster lists are deterministically derived.

---

## 2. Architectural Design: Pure Reducer & Single Source of Truth

### 2.1 Domain Model & Action Types
Stored in `src/lib/rsvpReducer.ts`:
```typescript
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
```

### 2.2 Pure Reducer (`rsvpReducer`)
```typescript
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
```

### 2.3 Pure State Derivation Functions
1. **User Status Derivation:**
```typescript
export function deriveCurrentUserStatus(
  rsvps: ClientRsvp[],
  currentMemberId: string
): "ATTENDING" | "DECLINED" | null {
  return rsvps.find((r) => r.memberId === currentMemberId)?.status || null;
}
```

2. **Roster Derivation:**
```typescript
export function deriveLineupRosters(
  rsvps: ClientRsvp[],
  currentMemberId: string
): {
  attendees: Array<{ id: string; name: string; queuedSince: Date }>;
  declined: Array<{ id: string; name: string }>;
} {
  const attendees = rsvps
    .filter((r) => r.status === "ATTENDING")
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
```

---

## 3. Component Integration in `QuizDetailClient.tsx`

```typescript
const [rsvps, dispatchRsvp] = useReducer(rsvpReducer, initialRsvps);

// Derived purely from the single source of truth
const currentUserRsvp = deriveCurrentUserStatus(rsvps, currentMemberId);
const { attendees, declined: declinedMembers } = deriveLineupRosters(rsvps, currentMemberId);
```

### Mutation Handlers:
* **`handleRsvpChange(status)`:**
  `dispatchRsvp({ type: "USER_RSVP", memberId: currentMemberId, name: currentMemberName, status });`
* **`confirmAdminOverrideDecline(memberId)`:**
  `dispatchRsvp({ type: "ADMIN_OVERRIDE_DECLINE", memberId });`
* **`handleAdminOverrideAttend(memberId)`:**
  `dispatchRsvp({ type: "ADMIN_OVERRIDE_ATTEND", memberId });`
* **`handleReorder(sourceIndex, destinationIndex)`:**
  `dispatchRsvp({ type: "ADMIN_REORDER", sourceIndex, destinationIndex });`

---

## 4. Verification & Testing

1. **Unit Tests (`tests/lib/rsvpReducer.test.ts`):**
   - Tests pure function transitions:
     - `USER_RSVP` creates new entry or flips existing status.
     - `ADMIN_OVERRIDE_DECLINE` updates status to `"DECLINED"` and zeroes `queuedSince`.
     - `ADMIN_OVERRIDE_ATTEND` updates status to `"ATTENDING"` and assigns new timestamp.
     - `ADMIN_REORDER` maintains correct relative timestamps without affecting declined players.
     - `deriveCurrentUserStatus` returns correct status after each transition.
     - Self-override scenario: Admin declines themselves -> `deriveCurrentUserStatus` returns `"DECLINED"`. Admin re-enrolls themselves -> `deriveCurrentUserStatus` returns `"ATTENDING"`.
2. **Component Tests (`tests/components/QuizDetailDeclined.test.tsx`):**
   - Verifies server HTML rendering with `renderToStaticMarkup`.
3. **Full Suite & Build:**
   - `npm test` and `npm run build`.
