# Client RSVP State: Single Source of Truth

This document explains the client-side state architecture for RSVPs and lineup rosters on the Quiz Detail page (`QuizDetailClient.tsx` & `src/lib/rsvpReducer.ts`).

---

## 1. The Problem (State Fragmentation & Drift)

Previously, the quiz details screen stored RSVP information across **three separate React state variables**:

```text
[❌ BEFORE: Split State]

                ┌─► useState<LineupMember[]>(attendees)
                │
Team RSVPs ─────┼─► useState<DeclinedMember[]>(declinedMembers)
                │
                └─► useState<"ATTENDING" | "DECLINED" | null>(currentUserRsvp)
```

### Why this broke:
When an admin clicked *"Afzeggen"* to decline themselves or another member:
1. The `attendees` array updated.
2. The `declinedMembers` array updated.
3. **`currentUserRsvp` did NOT update.**

Result: The lineup showed the player as declined, but their personal buttons (*"Ik doe mee"* / *"Ik pas"*) still said they were attending until the page was reloaded.

---

## 2. The Solution (Single Source of Truth)

We replaced all three state variables with a **single state array** managed by a pure React reducer (`rsvpReducer`):

```text
[✅ AFTER: Single Source of Truth]

                             ┌────────────────────────┐
                             │  rsvps: ClientRsvp[]   │
                             │ (Single Source of Truth│
                             └───────────┬────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │ Pure Derivation Functions                     │
                 ▼                                               ▼
    deriveCurrentUserStatus()                         deriveLineupRosters()
                 │                                               │
                 ▼                                       ┌───────┴───────┐
        currentUserRsvp                                  ▼               ▼
      ("ATTENDING" | "DECLINED")                     attendees        declined
                 │                                   (FIFO sorted)   (Chips)
                 ▼                                       │               │
            RsvpControl                             TeamLineup      TeamLineup
        ("Ik doe mee" / "Ik pas")                 (Active & Reserve) ("Afgemeld")
```

---

## 3. Data Model & Actions

### State: `ClientRsvp[]`
Located in `src/lib/rsvpReducer.ts`:
```typescript
export interface ClientRsvp {
  memberId: string;
  name: string;
  status: "ATTENDING" | "DECLINED";
  queuedSince: Date | null;
}
```

### Actions: `RsvpAction`
Every change goes through `dispatchRsvp`:

| Action | When it happens | What it does |
|---|---|---|
| `USER_RSVP` | Player taps *"Ik doe mee"* or *"Ik pas"* | Updates or adds the member's status; sets `queuedSince = now` if attending. |
| `ADMIN_OVERRIDE_DECLINE` | Admin clicks *"Afzeggen"* for any player | Sets status to `"DECLINED"` and zeroes `queuedSince = null`. |
| `ADMIN_OVERRIDE_ATTEND` | Admin clicks `+ Aanmelden` on a declined chip | Sets status to `"ATTENDING"` and assigns new `queuedSince = now`. |
| `ADMIN_REORDER` | Admin drag-and-drops active lineup members | Re-indexes `queuedSince` timestamps among attending players. Leaves declined players untouched. |

---

## 4. Pure Derivation (Zero Duplicate State)

Instead of updating child arrays manually, components receive purely derived data calculated on the fly:

1. **User Status:**
   ```typescript
   export function deriveCurrentUserStatus(
     rsvps: ClientRsvp[],
     currentMemberId: string
   ): "ATTENDING" | "DECLINED" | null {
     return rsvps.find((r) => r.memberId === currentMemberId)?.status || null;
   }
   ```
2. **Lineup Rosters:**
   ```typescript
   export function deriveLineupRosters(
     rsvps: ClientRsvp[],
     currentMemberId: string
   ): {
     attendees: Array<{ id: string; name: string; queuedSince: Date }>;
     declined: Array<{ id: string; name: string }>;
   } {
     // Attendees are strictly sorted by queuedSince ASC (FIFO)
     const attendees = rsvps
       .filter((r) => r.status === "ATTENDING")
       .sort((a, b) => new Date(a.queuedSince || 0).getTime() - new Date(b.queuedSince || 0).getTime())
       .map(...);

     const declined = rsvps
       .filter((r) => r.status === "DECLINED")
       .map(...);

     return { attendees, declined };
   }
   ```

---

## 5. Key Invariants & Guarantees

1. **No Out-of-Sync States:** It is impossible for `RsvpControl` (buttons) and `TeamLineup` (rosters) to show conflicting data because both read from the exact same `rsvps` array in real time.
2. **Self-Override Consistency:** If an admin declines or re-enrolls themselves, both their entry in the lineup and their personal RSVP buttons update in the exact same render cycle.
3. **Pure & Testable:** `rsvpReducer.ts` contains zero React or DOM dependencies. All state transitions are 100% deterministic pure functions tested under Node.js in Vitest (`tests/lib/rsvpReducer.test.ts`).
