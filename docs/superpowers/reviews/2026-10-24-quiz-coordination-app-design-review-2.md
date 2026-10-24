# Review Round 3: Locked Decisions & Remaining Findings

**Date:** 2026-10-24
**Reviewed document:** `docs/superpowers/specs/2026-10-24-quiz-coordination-app-design.md` (Status: Revised Draft, Post-Review Revision)
**Purpose:** Record the decisions made in the follow-up discussion and the findings that remain in the current revision.
**Scope note:** Findings already fixed in the current revision are **not repeated**. That excludes the reserve-state model, `attendingSince`, the UTC date/time model, RFC 5545 output, URL encoding rules, Prisma relation errors, and the native-mail interpretation.

This document supersedes the "Decisions Needed" section of the round-2 review. The round-2 review remains the record of what was fixed.

---

## 1. Locked Decisions

| # | Question | Decision | Consequence |
|---|---|---|---|
| D1 | Lineup after registration | The organizer does not care who shows up. No freeze, no update email, no snapshot. RSVPs stay open indefinitely; the participant list is for the group only. | `Team.registeredAt/ById` stays as a flag. `registrationSnapshot` and any "update registration" flow are removed. |
| D2 | Registration email content | Only the team name. No player names and no player count. Contact person is allowed. | The `mailto:` body is shortened; no lineup rendering, no count, no snapshot. |
| D3 | Registration prerequisites | No minimum. A team can be registered with zero, some, or all spots filled. Capacity is planning only. | The register action is independent of RSVP count and is always available unless already registered/cancelled/archived. |
| D4 | Teams and guests | One team per quiz in v1. Guests and multiple teams should remain possible later. | Enforce `@@unique([quizId])`; keep registration/payment on `Team` so multi-team does not require a data migration. No guest model in v1. |
| D5 | Payment | Only whether the fee was paid and who paid. No amounts, currency, basis, or shares. | `Team.paidById` + `Team.paidAt`; paid is derived. The flyer fee is display-only. |
| D6 | Missing start time | Required. | Add time to the required fields; no all-day or midnight fallback. |
| D7 | Admin RSVP override | Decline-only, audited. Admins cannot mark someone as attending. | Add `overriddenById/At`; treat an override as a decline and run normal promotion. |
| D8 | Member removal/deactivation | v2. | v1 roster is add-only. Remove `isActive`, `deletedAt`, and the deactivate action from the v1 design. |
| D9 | Lowering `maxTeamSize` | Demote the most recently added attendees; their reserve position follows their original queue time. | Use `queuedSince` ordering; do not move them to the "top" of the queue. |
| D10 | Timeline tabs | `In Beraad` means not registered yet, regardless of headcount. Enough RSVPs and registration are independent. | Tabs derive from the team registration flag and the quiz date, not from `maxTeamSize`. |
| D11 | Carpooling | v2. | Remove `RideStatus`, `seatsAvailable`, and the carpool UI from v1. |
| D12 | Admin authentication | No PIN. Role check plus a yes/no confirmation before executing the action. | Remove `adminPinHash` and the unlock flow. Confirmation scope for member actions is deferred to implementation. |
| D13 | Status model | `OPEN`, `CANCELLED`, `ARCHIVED`; `REGISTERED` is derived from `Team.registeredAt`. Cancelled quizzes go to the archive. | Remove `DRAFT` and `REGISTERED` from `QuizStatus`; add a "Geannuleerd" badge in **Archief**. |

---

## 2. Changes the Current Spec Needs to Match the Decisions

Each item below is a conflict between the locked decision and the current revision.

### C1 — Registration is still modelled on `Quiz`, with a snapshot (Blocker)

- **Current:** `Quiz.registeredAt`, `Quiz.registeredById`, `Quiz.registrationSnapshot` (§6.1); `QuizStatus.REGISTERED`; §7.3 sets `Quiz.status = REGISTERED` and saves the player snapshot.
- **Required:** Move `registeredAt/ById` to `Team`; delete `registrationSnapshot` and the snapshot logic; derive "registered" from `Team.registeredAt`; remove `REGISTERED` from `QuizStatus`.
- **Why:** D1/D13. There is no update flow and no roster snapshot.

### C2 — The registration email still includes players and a count (Blocker)

- **Current:** §2 goal says "team name and confirmed lineup"; §7.3 body includes `Aantal spelers: [count]` and four hardcoded player bullets.
- **Required:** Body contains only the team name, quiz title/date, and contact person. No count, no player list.
- **Why:** D2. The current body also hardcodes four players regardless of `maxTeamSize`, which is now doubly wrong.

### C3 — Registration is not explicitly independent of the lineup (Major)

- **Current:** §7.3 gates registration behind the "Heb je de inschrijving verzonden?" dialog and implies a filled lineup; §2's flow says registration happens after enough players respond.
- **Required:** State that the action is available with zero RSVPs and is not blocked by capacity. Only `registeredAt != null`, `CANCELLED`, or `ARCHIVED` hide it.
- **Why:** D3.

### C4 — Payment is over-modelled and there is no announced-fee field (Blocker)

- **Current:** §2 says "amount in EUR"; §6.1 `QuizPayment` has `amountCents`, `currency`, `feeBasis`, `isPaid`; §7.2 extracts `entryFeeCents`; `Quiz` has no `entryFee` field at all.
- **Required:** `Team.paidById` + `Team.paidAt`; paid derived; no amount/currency/basis/shares. Add `Quiz.entryFee String?` for display and make the extraction schema return `entryFee` (string), not `entryFeeCents`.
- **Why:** D5. The current schema both over-stores payment data and loses the advertised fee.

### C5 — Admin override is too broad and unaudited (Major)

- **Current:** §4.1 grants "Override another member's RSVP" without direction or audit; `Rsvp` has no override fields.
- **Required:** Decline-only; `overriddenById`, `overriddenAt`; an override triggers normal promotion; the member's next self-service change clears the override.
- **Why:** D7.

### C6 — Admin PIN still exists (Major)

- **Current:** §4.2 describes an admin secret PIN and session unlock; §6.1 has `TeamSetting.adminPinHash`.
- **Required:** Remove the PIN, the unlock state, and the hash. Role check plus confirmation only.
- **Why:** D12.

### C7 — Carpooling is still in the v1 schema and UI (Major)

- **Current:** §1 flow "carpool sharing"; §4.1 "RSVP for self & set carpooling"; §5.1.3 carpool toggle; §6.1 `RideStatus` and `seatsAvailable`.
- **Required:** Remove from v1; record as future work.
- **Why:** D11.

### C8 — Member deactivation is still in v1 (Major)

- **Current:** §4.1 "Manage member list"; §5.1.5 "deactivate departed members"; `Member.isActive`, `Member.deletedAt`, `@@index([isActive])`.
- **Required:** Remove removal/deactivation from v1; add-only roster. Note that v2 needs soft-delete plus a rule for active RSVPs.
- **Why:** D8.

### C9 — Guests and multiple teams are claimed but not modelled (Major)

- **Current:** §2 says "architected to support multiple teams or external guests"; `Team` has no `@@unique([quizId])`; `Rsvp.memberId` is required, so guests have no path.
- **Required:** v1: one team per quiz, no guests; add `@@unique([quizId])`. Keep the multi-team seam by keeping registration/payment on `Team`. State that guests require an attendee/guest model in v2.
- **Why:** D4.

### C10 — Status and tabs still use the old model (Major)

- **Current:** `QuizStatus` is `DRAFT | OPEN | REGISTERED | ARCHIVED | CANCELLED`; §5.1 labels **In Beraad** as "gathering players".
- **Required:** `OPEN | CANCELLED | ARCHIVED`; drop `DRAFT` and `REGISTERED`. **In Beraad** = upcoming and not registered; **Gepland** = upcoming and registered; **Archief** = past, archived, or cancelled. Show a "Geannuleerd" badge.
- **Why:** D10/D13.

### C11 — Time is not in the required fields (Major)

- **Current:** §7.2 requires `title`, `date`, `location`, `maxTeamSize`; `time` is optional, but `Quiz.startsAt` is non-nullable.
- **Required:** Add `time` to the required set.
- **Why:** D6.

### C12 — Team creation and the one-team invariant are not specified (Major)

- **Current:** `Team` has only `@@index([quizId])`; no rule says quiz creation creates the team; capacity logic assumes a team exists.
- **Required:** Quiz creation atomically creates exactly one `Team` (name from `TeamSetting`, `maxTeamSize` from the form); add `@@unique([quizId])`.
- **Why:** D4. Without this, the first RSVP has no team to lock or count.

### C13 — Two team-name sources (Minor)

- **Current:** `Team.name` defaults to "Ploeg 1"; §7.3 uses `TeamSetting.defaultTeamName`.
- **Required:** Copy `TeamSetting.defaultTeamName` into `Team.name` at creation and use `Team.name` in the email; allow an admin rename.
- **Why:** The registration subject and lineup header must not disagree.

### C14 — Hard delete contradicts the archive decision (Minor / open)

- **Current:** §4.1 allows admins to "archive or delete"; quiz deletion cascades RSVPs, teams, and payment history.
- **Required:** v1 archive/cancel only; no hard delete. This is a recommendation, not an explicit answer.
- **Why:** D13 only says cancelled goes to the archive. If you want hard delete, it needs an explicit confirmation and a decision about history.

### C15 — Confirmation scope is unresolved (Minor / deferred)

- **Current:** No confirmation rule; the earlier answer was "every action", then deferred to implementation.
- **Required:** State in the spec: every admin mutation is confirmed; member-facing confirmations are an implementation/UX decision.
- **Why:** Keeps the locked intent without over-specifying the UI.

---

## 3. Findings Still Open, Independent of the Decisions

These are not caused by the answers above and were not fixed in the current revision.

### F1 — Invite tokens are described but not modelled (Blocker)

- **Where:** §4.2 ("generates unique, high-entropy invite tokens"); §5.1.5 ("regenerate invite links"); §6.1 has no `Invite` model or token field.
- **Problem:** Nothing can validate, expire, single-use, or rotate an invite. "Regenerate" has no stored state.
- **Fix direction:** Add an `Invite` model (or token fields on `Member`) with a hashed token, `expiresAt`, `usedAt`, and rotation semantics.

### F2 — Waitlist ordering still has two sources of truth (Blocker)

- **Where:** §7.1.2 promotes `waitlistPosition = 1` **or** the earliest `attendingSince`; §7.1.3 moves the most recent attendees to the **top** of the waitlist; promotion sets `promotedAt` but does not define what happens to `attendingSince`.
- **Problem:** The two orderings can disagree. Moving a demoted attendee to the top can put them ahead of people who joined the reserve list earlier. AC §9.2 depends on a single answer.
- **Fix direction:** Use one key (`queuedSince`), never reset it on promotion, derive positions from it, and insert demotions by that timestamp. Remove `waitlistPosition` or make it purely derived.

### F3 — Concurrency strategy is still an either/or (Major)

- **Where:** §7.1 ("`SERIALIZABLE` isolation (or `SELECT FOR UPDATE` on the `Team` row)"), §9.1-9.2.
- **Problem:** No chosen strategy, no retry policy for serialization failures (Prisma `P2034`), no test for concurrent declines or a decline racing a capacity shrink.
- **Fix direction:** Choose serializable + bounded retry, or row lock; add the missing tests.

### F4 — Local SQLite contradicts the datasource (Major)

- **Where:** §3 offers "SQLite or local PostgreSQL"; §6.1 hardcodes `provider = "postgresql"`.
- **Problem:** Prisma's provider is compile-time; the same schema cannot run on SQLite. Local SQLite is not a supported path.
- **Fix direction:** Local PostgreSQL via Docker Compose; remove SQLite from the spec.

### F5 — "Standalone container on Vercel" is inaccurate (Major)

- **Where:** §3 and §8.1.
- **Problem:** Vercel builds serverless functions; `output: "standalone"` is for Docker/Fly/VPS self-hosting. The two deployment paths are conflated.
- **Fix direction:** State Vercel/serverless and Docker/standalone as separate targets.

### F6 — Session and invite security is under-specified (Major)

- **Where:** §4.2, §6.1 `Session.token`.
- **Problem:** Session tokens are stored in plaintext; invite expiry/single-use/rotation are unspecified; there is no logout or revocation route; the blanket "every route requires a session" has no exception list for `/auth/join` and `/auth/login`.
- **Fix direction:** Store SHA-256 hashes, define invite TTL/single-use/regeneration, add logout, and list public routes.

### F7 — iOS PWA session sharing is asserted, not solved (Major)

- **Where:** §4.2 "install the PWA after opening the invite link to preserve the session".
- **Problem:** Adding to the home screen does not guarantee the standalone PWA shares Safari's cookie jar. The member can end up signed out inside the PWA.
- **Fix direction:** Add an in-app "paste invite link/token" path so the invite can be claimed inside the installed PWA.

### F8 — Upload security and privacy are incomplete (Major)

- **Where:** §7.2, §8.1.
- **Problem:** MIME validation is described client-side only; the image is uploaded to a bucket and its URL is passed around without a private-bucket/signed-URL rule; flyer retention is unspecified; the vision provider's data handling is not noted.
- **Fix direction:** Server-side MIME/size validation, private bucket + signed previews, documented retention, subprocessor note.

### F9 — AI failure and cost controls are incomplete (Major)

- **Where:** §7.2.
- **Problem:** There is no timeout/5xx behavior (the manual tab exists, but the fallback is not specified); only a per-member rate limit exists (no global/daily quota); provider cost/tokens are not logged.
- **Fix direction:** Explicit fallback to manual entry, global quota, cost logging.

### F10 — Missing routes and UI for granted permissions (Major)

- **Where:** §4.1 vs §5.1.
- **Problem:** Admin RSVP override has no screen; there is no logout route; no team-settings screen for `TeamSetting`; no invite-entry field on `/auth/login`.
- **Fix direction:** Add them or remove the permission/field from v1.

### F11 — Acceptance criteria cover only five happy paths (Major)

- **Where:** §9.
- **Problem:** No criteria for registration with zero players, registration email content, payment, archiving/tabs, invite expiry, HEIC/oversize/MIME rejection, AI failure, or PWA install/invite claim.
- **Fix direction:** Expand the suite to cover the locked decisions and the failure paths.

### F12 — Privacy, retention, and backups are unspecified (Major)

- **Where:** §8.
- **Problem:** Flyer retention, member-data retention, AI subprocessor, backup/restore, and free-tier idle-pause mitigation are absent.
- **Fix direction:** Add a short operational section with defaults (e.g. delete flyers 90 days after the quiz, provider backups, no idle pause).

### F13 — Minor schema/ops nits

- `TeamSetting` is not truly a singleton (`@default("default-singleton")` does not prevent a second row); `contactEmail`/`contactPhone` are unused.
- `Session.@@index([token])` is redundant with `@unique`.
- `registrationSnapshot String?` is better as `Json` (or removed, per D1).
- `UID: quiz-[id]@be-quiz.local` should use the real app host.
- `doorsOpenTime` is not used by the calendar exports.
- `SESSION_SECRET` is unnecessary if session tokens are random and stored hashed.
- §7.5 mixes `%0A` and `%0D%0A` and does not name the encoder for interpolated fields.

---

## 4. Product Points Still Unanswered

These are not blocking a review, but they will block a clean implementation if left implicit:

1. **Who may mark the fee paid?** Current spec: any member. Keep, or admin-only?
2. **Hard delete:** Archive/cancel only, or keep an admin hard-delete with a stronger confirmation?
3. **Admin reset of the registration flag:** Keep it for mistakes, or is registration final?
4. **Admin edit of member contact details:** In scope for v1, or add-only?
5. **Confirmation scope for member actions:** Deferred to implementation; confirm that admin mutations are the only ones the spec mandates.

---

## 5. Suggested Order When Applying the Decisions

1. Answer the five points in §4.
2. Schema: move registration/payment to `Team`; add `Invite`; add `entryFee`; remove `QuizPayment`, `FeeBasis`, `RideStatus`, `isActive`/`deletedAt`, `adminPinHash`, `registrationSnapshot`, `waitlistPosition`.
3. Rewrite §7.1 around `queuedSince` and one concurrency strategy.
4. Rewrite §7.3 for the team-name-only email and zero-RSVP registration.
5. Rewrite the status/tab section and the permissions matrix.
6. Add auth/upload/rate-limit details and expand §9.
7. Re-run the builder check against the revised document.

---

## 6. What This Review Does Not Re-Open

Already fixed and intentionally excluded:

- Reserve state is represented (`WAITLIST`, `promotedAt`).
- Queue timestamp is no longer `createdAt`.
- Date/time is UTC + timezone + duration.
- Calendar output has RFC 5545 structure.
- URL/ICS encoding rules exist.
- Prisma relations and enums are syntactically valid.
- Native mail hand-off is an explicit goal/non-goal.
