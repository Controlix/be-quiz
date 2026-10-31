# ADR 0003: Single Source of Truth for Client State Management

**Date:** 2026-10-31  
**Status:** Accepted  
**Deciders:** Core Engineering Team  

---

## Context & Problem Statement
In `QuizDetailClient.tsx`, RSVP state was previously fragmented across three independent React state hooks:
- `attendees: LineupMember[]`
- `declinedMembers: DeclinedMember[]`
- `currentUserRsvp: "ATTENDING" | "DECLINED" | null`

When an admin modified a member's RSVP status (including their own via *"Afzeggen"* or *"+ Aanmelden"*), only the lineup arrays updated. `currentUserRsvp` was not synchronized, resulting in the user's action buttons showing stale, conflicting statuses until page reload. We needed a pattern that structurally prevents client UI state drift.

## Decision Drivers
- Single source of truth: Zero parallel or duplicate state arrays that can drift.
- Deterministic UI consistency between personal participation controls and team rosters.
- Pure state transitions testable under Node.js in Vitest without browser DOM dependencies.
- Zero extra dependencies (relying purely on React built-ins and TypeScript).

## Considered Options
1. **Option 1: Parallel State Hooks with Manual Synchronization Effects**
   - Keep existing `useState` hooks and write `useEffect` handlers or manual updater functions to synchronize `currentUserRsvp` on every change.
   - *Pros:* Minimal initial diff.
   - *Cons:* Fragile, error-prone, violates fundamental single-source-of-truth principles, and easily leads to re-render cascades or race conditions.

2. **Option 2: Heavy Client State Store (Redux Toolkit / Zustand)**
   - Introduce an external state management library.
   - *Pros:* Broadly known patterns in large-scale applications.
   - *Cons:* Unnecessary bundle overhead and dependency complexity for localized component roster state.

3. **Option 3: Pure State Reducer with Pure State Derivations (Selected)**
   - Maintain a single `rsvps: ClientRsvp[]` state managed by React's native `useReducer(rsvpReducer, initialRsvps)`.
   - Derive all UI projections (`currentUserRsvp`, active `attendees`, and `declinedMembers`) on the fly using pure functions (`deriveCurrentUserStatus`, `deriveLineupRosters`).
   - *Pros:* 100% bug-proof by design (impossible for buttons and rosters to diverge), zero third-party dependencies, and the reducer logic is 100% pure TypeScript tested under Node.js in Vitest.
   - *Cons:* Derivations recompute on state changes (negligible for typical team sizes of 4–10 players; easily wrapped in `useMemo` if needed).

## Decision Outcome
We chose **Option 3 (Pure State Reducer with Pure State Derivations)**. All client components reflecting domain state must maintain a single authoritative collection and derive sub-views purely.

## Consequences
- **Positive:**
  - Guaranteed UI consistency across all user actions and admin overrides.
  - Zero mock or browser DOM dependencies required for test verification.
  - No prop drift or breaking changes for child presentation components (`RsvpControl`, `TeamLineup`).
- **Negative / Trade-offs:**
  - State transitions must be modeled as formal actions in the reducer rather than ad-hoc inline setters.
- **Invariants Introduced:**
  - Client state representing a domain entity must be stored in a single unified collection or pure reducer. Sub-views, filtered lists, and statuses must be purely derived.

## Validation & Confirmation
- Verified via unit test suite in `tests/lib/rsvpReducer.test.ts` (100% passing across self-override decline/attend, first-time RSVP, and reordering) and component tests in `tests/components/QuizDetailDeclined.test.tsx`.
