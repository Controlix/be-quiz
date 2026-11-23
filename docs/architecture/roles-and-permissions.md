# Roles & Permissions Architecture: be-quiz

This document provides the authoritative specification of the authorization model, user roles, permission matrix, and domain safeguards in **be-quiz**.

For the overall system architecture, see [Architecture Overview](./overview.md).  
For client-side roster state synchronization and event reducers, see [Client RSVP State: Single Source of Truth](./rsvp-state.md).  
For the architectural decision record justifying coarse roles over granular permissions, see [ADR 0008: Role-Based Authorization over Granular Permissions](../adr/0008-role-based-authorization-over-granular-permissions.md).

---

## 1. Role Hierarchy & Player Dual-Identity

The application models permissions using the `Role` enum in `prisma/schema.prisma`:

```prisma
enum Role {
  USER
  ADMIN
}
```

Every user in the system is represented by a `Member` record with a designated role (defaulting to `USER`). Authentication is passwordless, utilizing a personal 4-digit PIN verified against a cryptographic hash (`pinHash`) with 90-day rolling HTTP-only session cookies.

### Roles & Actors

1. **Anonymous / Visitor:** Unauthenticated guest. Can redeem invitations, log in, view public calendar exports, or submit bug reports.
2. **`USER` (Regular Team Member):** Active team player. Can view upcoming quizzes, manage personal RSVPs, invite guests, register quizzes, and track logistics.
3. **`ADMIN` (Team Coordinator / Administrator):** Coordinator teammate with operational authority over team rosters, quiz settings, member accounts, and application configuration.

### The "Player Dual-Identity" Concept

In **be-quiz**, there is no detached or abstract "super-admin" persona. Administrators are active teammates who participate in quizzes, RSVP for lineups, and sit at the table alongside everyone else.

An administrator's personal interactions with a quiz (submitting their personal RSVP, viewing lineups, rating concluded events) are identical to regular members. However, their active session carries elevated permissions to manage team logistics, bench or add teammates, reorder lineups, and invite new members.

---

## 2. Comprehensive Permission Matrix

| Subsystem / Domain       | Action                           | Anonymous |      `USER`      |      `ADMIN`       | Enforcement Point       | Technical Implementation                                             |
| :----------------------- | :------------------------------- | :-------: | :--------------: | :----------------: | :---------------------- | :------------------------------------------------------------------- |
| **Authentication**       | Claim invite token               |    ✅     |        ✅        |         ✅         | Route Handler           | `GET /auth/join?token=...`                                           |
|                          | Log in with 4-digit PIN          |    ✅     |        ✅        |         ✅         | Server Action           | `loginWithPinAction`                                                 |
|                          | Initial PIN setup                |    ✅     |        ✅        |         ✅         | Server Action           | `setupInitialPinAction`                                              |
|                          | Log out                          |    ❌     |        ✅        |         ✅         | Route Handler           | `GET /auth/logout`                                                   |
| **Quiz Browsing**        | View quiz dashboard              |    ❌     |        ✅        |         ✅         | RSC Page Guard          | `src/app/quizzes/page.tsx` (`getSessionMember`)                      |
|                          | View quiz details                |    ❌     |        ✅        |         ✅         | RSC Page Guard          | `src/app/quizzes/[id]/page.tsx` (`getSessionMember`)                 |
|                          | Export iCal feed (`.ics`)        |    ✅     |        ✅        |         ✅         | Route Handler           | `GET /api/quizzes/[id]/calendar.ics`                                 |
|                          | Add to Google Calendar           |    ❌     |        ✅        |         ✅         | Client Helper           | `features/calendar/googleCalendar.ts`                                |
|                          | Share via WhatsApp / Mailto      |    ❌     |        ✅        |         ✅         | Client Helpers          | `features/sharing/`                                                  |
| **Quiz Creation**        | Access quiz creation wizard      |    ❌     |        ✅        |         ✅         | RSC Page Guard          | `src/app/quizzes/new/page.tsx` (`getSessionMember`)                  |
|                          | Create quiz manually             |    ❌     |        ✅        |         ✅         | Server Action           | `createQuizAction`                                                   |
|                          | Upload flyer image               |    ❌     |        ✅        |         ✅         | Route Handler           | `POST /api/quizzes/upload-flyer`                                     |
|                          | Extract flyer info via AI Vision |    ❌     |        ✅        |         ✅         | Route Handler           | `POST /api/quizzes/extract` (`features/vision`)                      |
| **Lineup & RSVPs**       | Self RSVP (Attend / Decline)     |    ❌     | ✅ _(pre-start)_ |  ✅ _(pre-start)_  | Server Action & Service | `joinQuizRsvpAction`, `declineQuizRsvpAction`, `rsvpService.setRsvp` |
|                          | Automatic FIFO queueing          |    ❌     |        ✅        |         ✅         | Domain Service          | `setRsvp` in `rsvpService.ts`                                        |
|                          | Add guest player                 |    ❌     | ✅ _(pre-start)_ |         ✅         | Server Action           | `addGuestAction`                                                     |
|                          | Remove personally invited guest  |    ❌     | ✅ _(pre-start)_ |         ✅         | Server Action & Service | `removeGuestAction` (`target.invitedById === actorId`)               |
|                          | Remove any guest player          |    ❌     |        ❌        |         ✅         | Server Action & Service | `removeGuestAction` (`actorRole === "ADMIN"`)                        |
|                          | Reorder active lineup / waitlist |    ❌     |        ❌        |         ✅         | Server Action           | `adminReorderRsvpAction` (`role === "ADMIN"`)                        |
|                          | Enroll unresponded teammate      |    ❌     |        ❌        |         ✅         | Server Action           | `adminOverrideAttendAction` (`role === "ADMIN"`)                     |
|                          | Reinstate declined teammate      |    ❌     |        ❌        |         ✅         | Server Action           | `adminOverrideAttendAction` (`role === "ADMIN"`)                     |
|                          | Override-decline / bench player  |    ❌     |        ❌        |         ✅         | Server Action           | `adminOverrideDeclineAction` (`role === "ADMIN"`)                    |
| **Team Logistics**       | Mark team registered             |    ❌     | ✅ _(pre-start)_ |         ✅         | Server Action & Service | `setRegisteredAction`, `registrationService.registerTeam`            |
|                          | Reset team registration          |    ❌     |        ❌        |         ✅         | Server Action           | `adminResetRegistrationAction` (`role === "ADMIN"`)                  |
|                          | Toggle entry fee payment         |    ❌     | ✅ _(pre-start)_ |         ✅         | Server Action & Service | `toggleFeePaidAction`, `paymentService.toggleFeePayment`             |
| **Quiz Administration**  | Edit quiz metadata               |    ❌     | ✅ _(pre-start)_ |         ✅         | Server Action & Service | `updateQuizDetailsAction`, `quizService.updateQuizDetails`           |
|                          | Access quiz admin edit page      |    ❌     |        ❌        |         ✅         | RSC Page Guard          | `src/app/quizzes/[id]/edit/page.tsx` (`role === "ADMIN"`)            |
|                          | Adjust maximum team size (1–10)  |    ❌     |        ❌        |         ✅         | Server Action           | `adminUpdateTeamCapacityAction` (`role === "ADMIN"`)                 |
|                          | Cancel quiz (move to archive)    |    ❌     |        ❌        |         ✅         | Server Action           | `adminCancelQuizAction` (`role === "ADMIN"`)                         |
| **Post-Quiz Evaluation** | Submit / update star rating      |    ❌     | ✅ _(eligible)_  |  ✅ _(eligible)_   | Server Action           | `rateQuizAction` (Must be concluded & starting lineup)               |
| **Member Management**    | Access `/admin/members`          |    ❌     |        ❌        |         ✅         | RSC Layout Guard        | `src/app/admin/layout.tsx` (`requireAdminSession`)                   |
|                          | Add new member & generate invite |    ❌     |        ❌        |         ✅         | Server Action           | `adminAddMemberAction` (`role === "ADMIN"`)                          |
|                          | Reset member PIN                 |    ❌     |        ❌        |         ✅         | Server Action           | `adminResetMemberPinAction` (`role === "ADMIN"`)                     |
|                          | Promote member to `ADMIN`        |    ❌     |        ❌        |         ✅         | Server Action & Service | `adminUpdateMemberRoleAction` (`role === "ADMIN"`)                   |
|                          | Demote `ADMIN` to `USER`         |    ❌     |        ❌        | ✅ _(safeguarded)_ | Server Action & Service | `adminUpdateMemberRoleAction` (Cannot demote self/last admin)        |
| **Team Settings**        | Access `/admin/settings`         |    ❌     |        ❌        |         ✅         | RSC Layout Guard        | `src/app/admin/layout.tsx` (`requireAdminSession`)                   |
|                          | Update default team name         |    ❌     |        ❌        |         ✅         | Server Action           | `adminUpdateDefaultTeamNameAction` (`role === "ADMIN"`)              |
| **Feedback & Triage**    | Submit feedback & screenshot     |    ✅     |        ✅        |         ✅         | Server Action           | `submitFeedbackAction`                                               |
|                          | Access `/admin/feedback`         |    ❌     |        ❌        |         ✅         | RSC Layout Guard        | `src/app/admin/layout.tsx` (`requireAdminSession`)                   |
|                          | Toggle feedback resolved status  |    ❌     |        ❌        |         ✅         | Server Action           | `toggleFeedbackResolvedAction` (`role === "ADMIN"`)                  |
|                          | Permanently delete feedback      |    ❌     |        ❌        |         ✅         | Server Action           | `deleteFeedbackAction` (`role === "ADMIN"`)                          |

---

## 3. Key Domain Safeguards & Invariants

### 3.1 Start-Time Roster & Mutation Lockdown

- **Personal RSVP Freeze (`isPersonalRsvpLocked`):** Once the quiz start time arrives (`Date.now() >= new Date(quiz.startsAt).getTime()`) or the quiz is `CANCELLED` / `ARCHIVED`, personal self-RSVP controls (_"Ik doe mee"_ / _"Kan niet"_) freeze for **all** members—including administrators—to prevent accidental table mis-taps.
- **User Constraints (`isQuizLockedForUser`):** Regular members (`USER`) cannot change their RSVP status, add/remove guests, or toggle team registration/payment flags once a quiz is locked.
- **Admin Bypass:** Administrators (`ADMIN`) retain full override authority after the quiz has started via explicit lineup override controls (`adminOverrideAttend`, `adminOverrideDecline`, `adminReorderRsvpAction`) and logistics actions (`setRegisteredAction`, `toggleFeePaidAction`). This allows coordinators to adjust lineups on the fly for late arrivals, substitutions, or door walk-ins directly at the venue.

### 3.2 Guest Player Ownership & Removal

- **Rule:** Guest players (`Rsvp` records where `memberId === null` and `guestName !== null`) are linked to the member who invited them via `invitedById`.
- **Permissions:**
  - The inviting member (`target.invitedById === sessionMember.id`) can remove their own guest prior to quiz start.
  - Other regular members cannot remove guests they did not invite.
  - Administrators can remove _any_ guest player at any time.

### 3.3 Role Modification Safeguards

Role promotions and demotions (`/admin/members`) are enforced with database-level validation in `src/services/memberService.ts`:

- **Self-Demotion Block:** An administrator cannot demote their own account (`targetMemberId === actorId` throws `"Je kunt je eigen beheerdersrol niet intrekken."`).
- **Last-Admin Invariant:** The system prevents demoting an administrator if they are the only remaining admin (`admins.length <= 1` throws `"Er moet minstens één beheerder overblijven."`), preventing permanent administrative lockout.

### 3.4 Single Source of Truth for Roster Overrides

- Administrative actions (`ADMIN_OVERRIDE_DECLINE`, `ADMIN_OVERRIDE_ATTEND`, `ADMIN_REORDER`) operate directly on the exact same authoritative roster state and dispatch domain events (`team.roster_changed`) as self-service user actions.
- An administrator acting on their own attendance status triggers identical reducer paths, ensuring the client UI never experiences desynchronized personal badges versus team lineup displays.

### 3.5 Rating Eligibility Constraint

- Quizzes can only be rated when concluded (`startsAt + durationMinutes <= now`) and when the quiz status is not `CANCELLED`.
- Only players who were in the **active starting lineup** (indices `0` to `maxTeamSize - 1`) are eligible to submit ratings. Reserve/waitlist players and non-attending members are blocked from submitting ratings (`NOT_ELIGIBLE`).

---

## 4. Enforcement Layers

1. **Next.js Layout Boundaries:**
   - `src/app/admin/layout.tsx` wraps all `/admin/*` routes with `requireAdminSession()`. If the active session is absent or does not have `role === "ADMIN"`, the application renders `AdminUnauthorizedDialog` preventing navigation.
2. **Server Action Authorization Guards:**
   - Privileged Server Actions (`adminActions.ts`, `reorderActions.ts`, etc.) start with session validation:
     ```ts
     const currentMember = await getSessionMember();
     if (!currentMember || currentMember.role !== "ADMIN") {
       return { success: false, error: "Niet geautoriseerd." };
     }
     ```
3. **Domain Service Invariants:**
   - Critical business constraints (such as guest ownership and last-admin protection) are asserted in domain services (`rsvpService.ts`, `memberService.ts`), ensuring integrity regardless of caller origin.
4. **Adaptive UI Adaptation:**
   - Client components inspect `isAdmin` and adaptively hide privileged buttons (e.g. reorder grip handles, bench buttons, admin settings link) to avoid clutter and prevent layout shifts.
