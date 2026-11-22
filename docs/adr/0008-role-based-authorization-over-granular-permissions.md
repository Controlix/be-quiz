# ADR 0008: Role-Based Authorization over Granular Permissions

**Date:** 2026-11-22  
**Status:** Accepted  
**Deciders:** Marc, Team

---

## Context & Problem Statement

As **be-quiz** expanded to support complex coordination workflows—such as administrative lineup reordering, member enrollment, guest management, and post-quiz ratings—questions arose regarding whether the system should migrate from a coarse two-role model (`USER` and `ADMIN`) to a granular, permission-based authorization architecture (e.g., individual claims or bitmasks such as `roster:reorder`, `member:invite`, `quiz:cancel`).

We need to establish whether the operational requirements of a team quiz coordination application justify the database, UI, and architectural overhead of granular permissions, or whether role-based access control (RBAC) anchored in a binary role enum remains the optimal design.

## Decision Drivers

- **Domain Fidelity & Player Dual-Identity:** Align with the real-world mental model where administrators are active playing teammates sitting at the table, not detached corporate superusers.
- **Minimal Operational & Configuration Overhead:** Avoid unnecessary UI complexity (permission checkboxes, role configuration screens) for team captains organizing casual events.
- **Database & Query Simplicity:** Maintain zero extra join tables, zero array lookups, and deterministic session evaluation without authorization caching layers.
- **YAGNI (You Aren't Gonna Need It) & Anti-Overengineering:** Prevent enterprise-grade access control patterns from bloating a lightweight sports/trivia coordination application.

## Considered Options

1. **Option 1: Database-Backed Granular Permissions (Full RBAC / ABAC)**
   - Introduce `Permission` and `MemberPermission` (or `RolePermission`) join tables in Prisma, with fine-grained keys (`quiz:create`, `roster:reorder`, `member:role_manage`).
   - _Pros:_ Maximum theoretical flexibility; allows defining arbitrary custom roles (e.g., "Treasurer", "Quiz Scout") or assigning bespoke permission sets per member.
   - _Cons:_ Massive database and query overhead; requires building complex permission management UIs in `/admin`; complicates Server Actions and RSC caching; significant cognitive burden on users.

2. **Option 2: In-Code Permission Mapping (Code-Mapped Capabilities)**
   - Retain the coarse database roles (`USER`, `ADMIN`), but decouple application guards via an in-memory TypeScript mapping (`ROLE_PERMISSIONS[role].includes(permission)`).
   - _Pros:_ Decouples route and action guards from raw role names; allows code-level refactoring without database migrations.
   - _Cons:_ Adds an unnecessary layer of indirection while the application has only two roles and a 1:1 correspondence between administrative actions and `ADMIN` membership; premature abstraction.

3. **Option 3: Coarse Role-Based Access Control (`USER` / `ADMIN`) with Ownership Checks (Selected)**
   - Keep the existing `Role` enum (`USER` and `ADMIN`) on `Member`, enforcing authorization directly via `currentMember.role === "ADMIN"` alongside contextual resource ownership rules (e.g., guest removal, player rating eligibility).
   - _Pros:_ Zero schema or UI bloat; perfectly mirrors the real-world coordinator-versus-player relationship; instant deterministic evaluation in Server Actions and route guards; zero cognitive friction when promoting/demoting teammates.
   - _Cons:_ Does not permit partial privilege delegation (e.g., allowing a teammate to edit quizzes without allowing them to manage members).

## Decision Outcome

We chose **Option 3: Coarse Role-Based Access Control (`USER` / `ADMIN`) with Ownership Checks** because:

1. The domain consists solely of team players and team coordinators; there is no real-world requirement for segmented or fractional administrative privileges.
2. The "Player Dual-Identity" invariant treats coordinators as teammates with operational override authority, not separate security principals.
3. Contextual constraints that do require finer granularity (such as a member only removing guests they personally invited, or players only rating quizzes they played in) are naturally modeled as pure resource-ownership rules rather than global permissions.

If the application ever expands into multi-tenant league management or introduces distinct operational responsibilities (e.g. a dedicated treasurer), Option 2 (In-Code Mapping) can be adopted incrementally without database schema disruption.

## Consequences

- **Positive:**
  - Database schema remains clean and minimal: single `role` column on `Member` with enum `Role { USER, ADMIN }`.
  - Admin management remains a one-click action in `/admin/members` (promote to `ADMIN` or demote to `USER`) without permission matrix modals.
  - Server Actions and layout guards evaluate authorization synchronously in a single line without supplementary queries or join overhead.
  - High alignment with documented architectural rules in `docs/architecture/roles-and-permissions.md`.
- **Negative / Trade-offs:**
  - Administrative authority is all-or-nothing: granting someone coordinator access to reorder lineups also grants access to invite members and cancel quizzes.
- **Invariants Established:**
  - Authorization guards MUST check `currentMember.role === "ADMIN"` or contextual ownership (`invitedById === actorId`), avoiding fragmented ad-hoc capability arrays.
  - Granular permissions must not be introduced into the database schema unless multi-tenant organizational requirements emerge and are documented via a superseding ADR.

## Validation & Confirmation

- Verified by existing route guards (`AdminLayout` using `requireAdminSession()`), Server Action guards (`adminActions.ts`), and unit test suites verifying admin-only constraints.
- Fully documented in [`docs/architecture/roles-and-permissions.md`](../architecture/roles-and-permissions.md).
