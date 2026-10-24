# Design Review: Pub Quiz Coordination App (BE-Quiz)

**Date:** 2026-10-24
**Reviewed document:** `docs/superpowers/specs/2026-10-24-quiz-coordination-app-design.md` (Status: In Review, Draft)
**Source requirements:** `requirements.md`
**Review type:** Design review before planning (builder check + adversarial review)
**Verdict:** Not ready for planning. Product intent and stack choice are sound; the core RSVP/waitlist mechanism cannot be represented by the schema as written, access control is unspecified, and two deployment claims contradict each other.

---

## 1. What Holds Up

- Clear intent, concrete pain, and explicit anti-goals; PWA instead of app stores is the right call for a private group.
- The entity set (`Member`, `Quiz`, `Rsvp`, `TeamSetting`) covers the domain at a glance.
- Verify-before-save on AI extraction is the right pattern.
- Manual confirmation of registration is the right instinct, given a `mailto:` handoff.
- Non-goals correctly exclude in-app payments, chat, and two-way calendar sync.
- Low-cost, portable deployment is a reasonable constraint at this scale.

---

## 2. Blockers

### B1. The reserve list does not exist in the model

- **Where:** §5.4 vs. §5.3 `Rsvp.status`
- **Problem:** §5.4 describes a "Reserve List with queue position" and a promotion. `Rsvp.status` only allows `ATTENDING`, `DECLINED`, `MAYBE`. There is no reserve state, queue position, or promotion timestamp. If reserve is derived ("first N attending"), the "clear visual indicator" is impossible and promotion is invisible. If it is stored, the schema is missing the fields.
- **Fix direction:** Choose either (a) stored queue state, e.g. `status = ATTENDING | WAITLIST | DECLINED | MAYBE` plus `waitlistPosition`, `promotedAt`, or (b) a documented derivation from `attendingSince` with an explicit "active vs reserve" computed view. Write the rule into the spec either way.

### B2. Queue priority uses an immutable timestamp

- **Where:** §5.3 `Rsvp.createdAt`; §5.4 ordering `createdAt ASC`
- **Problem:** A member who declines on Monday and changes to ATTENDING three weeks later still sorts ahead of someone who said yes on Tuesday. `MAYBE -> ATTENDING` has the same effect. `updatedAt` is not a substitute because ride-sharing edits also touch it.
- **Fix direction:** Add `attendingSince DateTime?`, set on every transition into ATTENDING, and order the lineup/reserve list by it. Define what happens on ATTENDING -> MAYBE -> ATTENDING (re-queue at the end).

### B3. Capacity check has no concurrency control

- **Where:** §5.4
- **Problem:** Count-then-insert is a read-then-write race. Two friends tapping within seconds both see "one spot left" and both become active. Two declines can promote two reserves for one freed spot.
- **Fix direction:** Specify a serializable transaction or `SELECT ... FOR UPDATE` row lock for RSVP changes and promotions; add a concurrency test (parallel accepts at capacity, parallel declines). State the behavior when `maxTeamSize` is lowered below the current count.

### B4. Authentication and identity are not buildable as written

- **Where:** §5.1
- **Problem:** "Secure persistent cookie or magic link" leaves every important detail open: first-visit identity resolution, token signing, TTL, revocation, lookup key, cookie flags, CSRF. The two obvious shortcuts (pick-your-name screen, unsigned `memberId` cookie) allow impersonation, including admin. "Admin passcode or secure admin URL" has no hashing, rate limit, or rotation; a capability URL pasted into WhatsApp is permanent admin. On iOS, a magic link opens in Safari, whose cookie jar is separate from the installed PWA, so "remembered on their phone" can fail silently.
- **Fix direction:** Decide the identity model explicitly. If it is invite/session links: signed, `httpOnly`, `Secure`, `SameSite=Lax`, expiry + revocation, server-side role checks on every mutation, a member-switch/logout path, and an iOS PWA test. If it is honor-system name picking: say so and scope admin separately. Hash and rate-limit the admin credential.

### B5. Date/time model cannot produce correct calendar output

- **Where:** §5.3 `date DateTime`, `startTime String?`; §5.6 `dates=[StartISO]/[EndISO]`
- **Problem:** No timezone and no end time. `dates=[StartISO]/[EndISO]` is not a valid Google Calendar format (`YYYYMMDDTHHMMSSZ` or `ctz` is required). A date-only value becomes UTC midnight, i.e. 01:00 in Brussels (and the previous day west of UTC).
- **Fix direction:** Store `startsAt` (UTC) + `timeZone` (default `Europe/Brussels`) + `endsAt` or `durationMinutes`; keep an optional separate doors/open time if needed. Specify exact Google and RFC 5545 formats.

### B6. Flyer upload fails on the default deployment

- **Where:** §5.2, §5.3 `flyerImageUrl`, §6, §7 ("local file storage or Cloudinary/S3" left to builder)
- **Problem:** Vercel's filesystem is read-only/ephemeral, so local storage loses images. A 12 MP iPhone photo commonly exceeds the 4.5 MB request-body limit, producing a 413 before extraction. HEIC from iOS needs conversion before most vision APIs accept it.
- **Fix direction:** Commit to object storage (Vercel Blob or S3-compatible) with direct or pre-signed upload; downscale/compress client-side before upload and before the vision call; convert HEIC; define max dimensions, MIME allowlist, and retention.

### B7. Payment tracking cannot represent the fee structures the extractor expects

- **Where:** §5.2 `entryFee`, §5.3 `isPaid`, `paidAmount`, `paidById`; requirements line about remembering who paid
- **Problem:** `entryFee`/`paidAmount` are free-text strings, so per-team vs. per-player is unknowable and nothing can be summed or compared. `isPaid` is independent of `paidById`, so "paid, nobody paid" is representable. No `paidAt`, no currency. A single `paidById` per quiz cannot express per-player or split payment.
- **Fix direction:** Store integer cents + a `TEAM | PER_PLAYER` basis + currency (EUR) + `paidAt` + payer. Either derive `isPaid`, or keep it but enforce the invariant in the service layer. Decide explicitly whether one payer per team is the model (probably yes for this group).

### B8. "SQLite or Postgres with zero code changes" is false

- **Where:** §3, §6
- **Problem:** Prisma's provider and migrations are compile-time, so switching is not zero-code. SQLite cannot run on Vercel (no shared persistent filesystem); it is Docker/Fly/VPS-only. String statuses are partly a consequence of keeping SQLite as an option. The serverless Postgres path also needs connection pooling; Alpine needs musl Prisma binaries; a free Supabase project can pause after inactivity, which is likely at 10-20 quizzes/year.
- **Fix direction:** Postgres in production, SQLite for local dev only. Document the pooled `DATABASE_URL`, Prisma binary targets for the container, and an idle-pause mitigation (or accept cold starts).

### B9. Prisma schema errors

- **Where:** §5.3
- **Problem:**
  - `Quiz.registeredById` has no `registeredBy` relation: dangling scalar, no FK, `include: { registeredBy: true }` fails.
  - Optional `paidBy`/`createdBy` relations default to `onDelete: SetNull`, so deleting a member erases "who paid" while `isPaid`/`paidAmount` remain.
  - `Rsvp.member onDelete: Cascade` means "remove friend" silently deletes their RSVPs and promotes a reserve.
  - `role`, `Quiz.status`, `Rsvp.status` are unvalidated strings.
  - Missing indexes for the hot queries: `(quizId, status, attendingSince)` and quiz date/status.
  - `Member.email` is nullable and non-unique (bad for any magic-link lookup).
  - `TeamSetting` has no singleton constraint or seed.
- **Fix direction:** Add the missing relation and back-relation on `Member`; use `Restrict` for payer/creator; soft-delete members (`deletedAt`/`isActive`) instead of cascading history; add enums or check constraints; add indexes; make email unique when present; give `TeamSetting` a fixed singleton id and a seed.

---

## 3. Major Gaps

### M1. Promotion is silent

- **Where:** §5.4 ("clear visual indicator" only); no notification section.
- **Problem:** The main value of the waitlist is that a reserve gets a spot, but there is no notification channel and no accept/expiry window. A promoted person may have made other plans and silently holds the spot while the next reserve is never asked.
- **Fix direction:** Choose a channel (PWA push, email, or explicit "share update to WhatsApp" flow) and a promotion confirmation window with automatic pass-on. Decide whether the group accepts manual WhatsApp updates as sufficient.

### M2. No screen/route inventory

- **Where:** whole document; §7 leaves "exact UI styling" only.
- **Problem:** There is a data model but no list of screens or routes. Missing: timeline/list, quiz detail, upload/verify, member admin, team settings, maybe a public share view. This is more than styling and should not be left implicit.
- **Fix direction:** Add a short screen/route inventory and the primary user flows (upload -> verify -> RSVP -> register -> pay -> calendar -> share).

### M3. No post-save edit flow; archive is unrepresentable

- **Where:** §5.1 (admin archive/delete), §5.2 (correction before save), `Quiz` schema.
- **Problem:** A wrong AI-extracted date/venue can only be fixed before saving; otherwise only deleted. Deleting cascades RSVPs/payment history. `ARCHIVED` is mentioned in prose but not in the status lifecycle or schema.
- **Fix direction:** Add `archivedAt`/`cancelledAt` (or explicit `ARCHIVED` status), an edit path with permissions, and soft delete. Define the rule for lowering `maxTeamSize` below current attendance.

### M4. Registration flow is fragile

- **Where:** §5.5
- **Problem:** `mailto:` can do nothing on iOS with only Gmail configured, or inside a standalone PWA, yet the "did you send it?" prompt still sets `REGISTERED`. No one-time lock, so the team can be registered twice or with zero attendees. The body hardcodes four player bullets regardless of `maxTeamSize`. `to:` is empty when `organizerEmail` is null. There is no undo.
- **Fix direction:** Render the body from the active lineup; disable/lock after registration with an explicit undo; fall back to copy-to-clipboard and the `registrationUrl` when email is missing; store the rendered recipient/body snapshot at registration time; make "sent" a self-attestation with a clear timestamp and actor.

### M5. AI extraction has no failure path, manual entry, or duplicate detection

- **Where:** §5.2
- **Problem:** Nothing covers timeout/5xx, illegible or multi-date flyers, missing year ("14 november"), HEIC, or a missing `location` (required by the schema). `maxTeamSize` silently defaults to 4, which can bench players if the flyer actually said 6. "Aantal deelnemers" on a flyer may mean team size or venue capacity. The same flyer uploaded twice creates duplicate quizzes with split RSVPs.
- **Fix direction:** Manual entry without a flyer; per-field validation and normalization (Dutch month names, year inference, confidence); explicit "unknown capacity" instead of silently defaulting; duplicate check on title + date + venue with a merge/archive action.

### M6. Calendar integration overpromises

- **Where:** §5.6; goal "one-tap add to Google Calendar" and `.ics` subscription.
- **Problem:** `action=TEMPLATE` creates the event in the signed-in user's default calendar; it cannot target the group's shared calendar (and the non-goal excludes the API route that would). Payment status is missing from the event details. The `.ics` "subscription" has no route and conflicts with cookie auth.
- **Fix direction:** Make `.ics` import the primary path (the OS lets the user choose the calendar); include payer status in details; either design a tokenized feed or drop "subscription" and say one-off export.

### M7. No encoding/serialization rules

- **Where:** §5.5, §5.6
- **Problem:** Every payload is an unencoded template. A title like "Quiz & Bier", or a venue with `&`, comma, or newline, truncates WhatsApp text and Google `location`/`details`. ICS lacks `UID`, `DTSTAMP`, line folding, and RFC 5545 escaping; regenerated files create duplicates and malformed entries.
- **Fix direction:** Builder functions that `encodeURIComponent` every component; `%0D%0A` for mailto bodies; a proper ICS serializer with `quiz.id@host` UID and CRLF-safe escaping.

### M8. Carpooling cannot represent "who rides with whom"

- **Where:** §5.3 `rideStatus`, `seatsAvailable`; requirement about who rides with whom.
- **Problem:** No driver-passenger assignment, no request/accepted state, no seat enforcement (seats can be exceeded or negative). A list of drivers still requires the WhatsApp discussion the app is meant to replace.
- **Fix direction:** Either add a ride assignment (passenger -> driver) with a seat check, or explicitly scope the feature down to "advertise seats" and say so.

### M9. Status lifecycle conflates separate concerns

- **Where:** §5.3 `Quiz.status` (`DRAFT`, `OPEN`, `REGISTERED`, `CANCELLED`)
- **Problem:** `CANCELLED` could mean "the organizer cancelled the quiz" or "we decided not to attend". `REGISTERED` does not say whether RSVPs stay open afterwards. There is no `ARCHIVED`/`PAST` distinction. No transition table exists.
- **Fix direction:** Separate quiz existence (scheduled/cancelled by organizer) from group decision (going/not going/registered), or document each status precisely with allowed transitions. Add archived/past handling.

### M10. Share links have no visibility model and leak data

- **Where:** §5.6 WhatsApp text uses `[App URL/quiz/id]`; §5.1 access model.
- **Problem:** If that page is public (the natural implementation), non-members see names, contact details, declines, ride status, and who paid. If private, the link cannot reach the people the requirements mention. Flyer images often contain organizer contact details and go to a public bucket and a US AI provider with no retention/processor note.
- **Fix direction:** Define a minimal public share view (title, date, venue, spots left, sign-up link) and an authenticated member view. State image retention and the AI subprocessor.

### M11. No cost/abuse controls on the vision endpoint

- **Where:** §5.2 `/api/quizzes/extract`; §3 cost constraint.
- **Problem:** Every upload is a paid call with no auth requirement, per-member rate limit, daily quota, size/MIME cap, or token/cost logging. The anti-goal forbids captcha, and the WhatsApp URL may be widely reachable.
- **Fix direction:** Require an authenticated member, enforce quotas and size limits after downscaling, validate MIME, and log tokens/cost per extraction.

### M12. One team per quiz is assumed, not stated

- **Where:** §5.3 `maxTeamSize` caps `ATTENDING` rows that each reference a `Member`; §5.4.
- **Problem:** The schema assumes exactly one team per quiz and no guests. With 10-15 friends and team sizes of 4-6, the group may field two teams, or a member may bring a friend. Both require a `Team`/`Attendee` structure, not a UI tweak.
- **Fix direction:** Confirm the product rule before planning. If either is possible, decouple attendees from members and put capacity on the team.

### M13. Mail integration may not meet the requirement

- **Where:** §5.5 vs. requirements ("Integratie met mail is een must").
- **Problem:** The design only hands off to the phone's mail client. That may be the intended meaning, but it is not stated. If the app must send and track the email, the plan gains an email subsystem, provider, templates, deliverability, and reply handling.
- **Fix direction:** Confirm the interpretation and record it in the non-goals or goals.

### M14. Missing operational and product details

- Initial member seeding and invite flow (how the first phone binds to a member) is unspecified.
- No decision on UI language: strings are mixed Dutch/English. Default proposal: Dutch (`nl-BE`) UI, English code identifiers.
- `MAYBE` is not in the requirements and its interaction with the lineup/reserve list is undefined; consider dropping it or defining it.
- No acceptance criteria or definition of done (e.g. "register a quiz in under 60 seconds", "no overbooking under concurrent accepts").
- No backup/restore or migration strategy for a database that will hold real member contact data.
- Privacy/GDPR: member emails/phones and flyer images; state what is stored, where, and for how long.

---

## 4. Decisions Needed Before Revision

Answer these and the rest can be settled with defaults.

1. **Team structure (most consequential):** Can a single quiz have more than one team from the group, or players who are not in the app? Or is it always exactly one team of registered members?
2. **Promotion and reminders:** How are waitlist promotions and payment reminders delivered: PWA push, email, or is a manual WhatsApp share/update sufficient?
3. **Mail integration:** Is pre-filling the phone's mail client the intended meaning of "mail integration is a must", or must the app send the registration email itself?
4. **Edit permissions:** May any member edit/delete a saved quiz, or only the uploader and admins? May admins edit other people's RSVPs or override capacity?
5. **Share visibility:** Should the quiz link be publicly viewable in a minimal read-only form, or members-only?
6. **Capacity when the flyer is unclear:** Default to 4 silently, warn and ask, or allow "unknown" and block registration until confirmed?
7. **Payment model:** One payer for the whole team, or per-player shares? (Recommend one payer for this group, with amount + date.)

---

## 5. Suggested Processing Order

1. Answer the decisions in §4 (especially 1).
2. Revise the schema: `attendingSince`, queue state, payment fields, date/time, relations/delete behavior, indexes, status enums, singleton settings, soft-delete members.
3. Revise §5.4 with the exact queue algorithm, transaction boundary, and promotion semantics.
4. Revise §5.1 with a concrete identity/bootstrap/revocation model and admin authorization.
5. Add the missing sections: screen/route inventory, AI failure/manual entry, duplicate detection, notification behavior, edit/archive, public vs. member views, encoding rules, acceptance criteria.
6. Fix §6 deployment statements (Postgres-only in production, object storage, pooling, binary targets).
7. Re-run the builder check on the revised document before moving to `writing-plans`.

---

## 6. Review Method

- Read the design against `requirements.md`.
- Independent builder check: "what would I still need to guess before planning?"
- Independent adversarial review: data model, RSVP correctness/concurrency, auth, requirement coverage, deployment, encoding, failure paths, privacy/cost.
- Findings deduplicated and ranked above. No code exists yet; all changes are document-level.

---

# Round 2 Review (Post-Revision)

**Date:** 2026-10-24
**Reviewed document:** revised `2026-10-24-quiz-coordination-app-design.md` (Status: Revised Draft)
**Verdict:** Substantially improved. Core structural complaints are addressed and the Prisma schema now validates. Still **not ready for planning**: three blockers remain, two are regressions introduced by the revision, and the waitlist/registration semantics are still ambiguous.

**Verification:** The §6.1 schema was extracted and run through `prisma validate` with Prisma 6.16.2 — result: `The schema is valid`. Syntax and back-relations are sound; the remaining schema issues are semantic.

---

## R2.1 Status of Round 1 Findings

| Finding | Status | Evidence / what remains |
|---|---|---|
| B1 Reserve list missing | **RESOLVED** | `RsvpStatus.WAITLIST`, `waitlistPosition`, `promotedAt`; promotion algorithm §7.1.2. |
| B2 Immutable queue timestamp | **RESOLVED** | `attendingSince` set on transitions; `MAYBE` removed. Caveat: promotion does not define what happens to it (see R2.3-4). |
| B3 Concurrency | **PARTIAL** | Transaction + row lock named; ACs added. Still an "either/or", no serialization-failure retry policy, no concurrent decline test, no re-check after a concurrent capacity shrink. |
| B4 Auth/identity | **PARTIAL** | Cookie flags, `Session` table, roles, bcrypt PIN, iOS note. Missing invite-token storage (R2.2-2), admin-unlock state, logout/revocation route, CSRF, PIN rate limit, session expiry recovery. |
| B5 Date/time | **RESOLVED** | `startsAt` UTC, `timeZone`, `durationMinutes`; Google format and RFC 5545 output specified. New gap: time is not in the required-field list while `startsAt` is non-nullable (R2.3-7). |
| B6 Flyer upload | **PARTIAL** | HEIC conversion, resize, 4MB cap, MIME allowlist, object storage. Missing server-side MIME sniffing, authorized/pre-signed upload, bucket privacy, retention. |
| B7 Payment model | **PARTIAL** | Cents, currency, `feeBasis`, `paidAt`, payer added. `isPaid` still independent of payer/amount/date; `PER_PLAYER` cannot express shares; the quoted fee itself has no field (R2.2-1). |
| B8 SQLite/Postgres | **PARTIAL** | Postgres production, pooling, musl targets, Docker. §3 still advertises SQLite for local dev against a hardcoded `provider = "postgresql"`; "standalone container on Vercel" is inaccurate. |
| B9 Prisma errors | **RESOLVED (syntactically)** | Schema validates; relations, enums, indexes, `Restrict`, unique email fixed. Semantic gaps: `TeamSetting` is not truly a singleton, `Team` has no one-per-quiz constraint, member deletion is in practice impossible. |
| M1 Silent promotion | **PARTIAL** | WhatsApp share button + template + UI flag. No owner, no accept/expiry, no guarantee the promoted member sees it. Accepted non-goal (no push), but the consequence should be stated. |
| M2 Route inventory | **PARTIAL** | Eight routes listed. Missing: team settings, logout/revocation, admin RSVP override UI (permission exists in the matrix, no screen). |
| M3 Edit/archive | **PARTIAL** | Admin edit route, `ARCHIVED`/`CANCELLED` enums. No `archivedAt`/`cancelledAt`, quiz delete still cascades history, no guard on deleting a registered/paid quiz, uploaders cannot edit their own quiz. |
| M4 Registration | **PARTIAL** | Snapshot, lock, copy fallback, registration URL, admin undo. Body still hardcodes four players; no null-`organizerEmail` guard; no zero-lineup guard; no guard against re-registering; snapshot can go stale. |
| M5 AI failure/manual/dupes | **PARTIAL** | Manual tab, required-field gating, duplicate warning. No timeout/5xx path, no "unknown capacity", no Dutch-date/year normalization, no merge action. Extracted fee cannot be stored (R2.2-1). |
| M6 Calendar | **RESOLVED** | `.ics` with UID/DTSTAMP/folding/escaping and payment details; subscription wording removed. |
| M7 Encoding | **RESOLVED** | Percent-encoding, `%0D%0A`, URL-encoded Google params, ICS escaping. Minor: §7.5 mixes `%0A`/`%0D%0A` and does not name the encoder for interpolated values. |
| M8 Carpooling | **OPEN** | Still only `rideStatus` + `seatsAvailable`; no driver↔passenger assignment, no seat check, no explicit scope-down. See R2.4-1. |
| M9 Status lifecycle | **PARTIAL** | `ARCHIVED` added. No transition table; `REGISTERED` semantics undefined; `DRAFT` unused; tab mapping (`Gepland` / `In Beraad` / `Archief`) undefined. |
| M10 Share visibility | **PARTIAL** | Members-only is now explicit. But the WhatsApp link points at an auth-gated page (only usable by members), and bucket privacy/AI retention are still unspecified. |
| M11 Cost/abuse | **PARTIAL** | Auth + 5 uploads/member/hour + size/MIME caps. No global/daily quota, cost logging, or rate-limit store that works across serverless instances (75 paid calls/hour ceiling). |
| M12 One team | **PARTIAL** | `Team` model + "1 team for now" decision. Nothing creates the team or enforces one per quiz; guests still unrepresentable; quiz-level payment/registration contradict the multi-team future claim. |
| M13 Mail interpretation | **RESOLVED** | Native hand-off is now an explicit goal and "no server email relay" an explicit non-goal. |
| M14 Operational gaps | **PARTIAL** | `nl-BE`, MAYBE removed, ACs added. Still missing backups/restore, migrations, GDPR/retention, invite seeding detail, broader ACs. |

---

## R2.2 Remaining Blockers

### R2.2-1. The quoted entry fee has no home (regression)

- **Where:** §7.2 extracts `entryFeeCents`; §5.1.2/§5.1.3 show "Entry Fee"; §6.1 `Quiz` has no fee field.
- **Problem:** `QuizPayment.amountCents` is the amount *paid*, optional, and only meaningful once `isPaid`; it cannot store what the flyer announced. The fee is discarded on save, cannot be shown before payment, and cannot be compared with what was paid. The AI schema also has no `feeBasis`, so per-team vs. per-player is ambiguous again. The original draft had `entryFee`; the revision removed it.
- **Fix:** Add `entryFeeCents Int?` and `feeBasis FeeBasis @default(TEAM)` to `Quiz` (or a separate `QuizFee`), and add `feeBasis` to the extraction schema. Keep `QuizPayment` for what was actually paid.

### R2.2-2. Invite tokens are described but not modelled

- **Where:** §4.2 invite flow; §5.1.5 "regenerate invite links"; §6.1 `Member`/`Session`.
- **Problem:** There is no `InviteToken` model or field. Nothing can validate, expire, single-use, or rotate an invite; "regenerate" has no stored state. It is also unspecified whether regenerating invalidates existing sessions.
- **Fix:** Add an `Invite` model (or `inviteTokenHash`, `inviteExpiresAt`, `inviteUsedAt` on `Member`), define one-time use and expiry, and state the effect of regeneration on live sessions.

### R2.2-3. Nothing creates a `Team`, and the one-team invariant is unenforceable

- **Where:** §6.1 `Team`; §7.1 capacity logic; §5.1.2 collects "Team Size".
- **Problem:** Every RSVP locks/counts `team.maxTeamSize`, but a quiz can be saved with zero teams: no §7 rule creates one, and `Team` has no `@@unique([quizId])`. The first RSVP then has no row to lock. The "future multi-team" claim is also contradicted by quiz-level `QuizPayment` (`quizId @unique`), quiz-level registration audit, and quiz-level calendar/WhatsApp output.
- **Fix:** State that quiz creation atomically creates exactly one `Team` (name + `maxTeamSize` copied from the form), add `@@unique([quizId])` for the v1 invariant, and either drop the multi-team future claim or move payment/registration to `Team` now.

### R2.2-4. Waitlist ordering has two sources of truth and a contradictory demotion rule

- **Where:** Goals §2 ("strict FIFO based on `attendingSince`"); §7.1.2 ("`waitlistPosition = 1` (or earliest `attendingSince`)"); §7.1.3 ("most recently added attending ... moved to the top of the WAITLIST"); §6.1 `attendingSince` comment.
- **Problem:** Three different orderings are in play. If positions are authoritative, the timestamp fallback is dead code; if timestamps are authoritative, `waitlistPosition` must be derived, not stored. Promotion sets `promotedAt` but leaves `attendingSince` untouched, while the comment calls it the latest transition to ATTENDING — so it is unclear whether a promoted member keeps their original queue time. Finally, moving a demoted attendee to the "top" can put them ahead of reserves who joined earlier (e.g. reserve E joined in December, attendee D joined in January; shrinking capacity must not put D ahead of E).
- **Fix:** Choose one ordering key (`queueSince`, immutable while queued, set on join, never reset on promotion) and derive both active/reserve order and positions from it. On demotion, insert by that timestamp (usually the end). Define `attendingSince` as either that queue time or drop it. Choose serializable or row-lock, not both.

### R2.2-5. `REGISTERED` does not say whether the lineup freezes

- **Where:** §7.3 registration lock/snapshot; §7.1 still allows transitions; §5.1.3.
- **Problem:** After the team is registered, any attendee can still decline and a reserve is auto-promoted. The registration snapshot then diverges from the live roster, and the organizer has an outdated player list. Nothing says whether `REGISTERED` locks RSVPs, whether a new member can join, or whether an "update registration" action exists. The snapshot is also overwritten or versioned? Unspecified.
- **Fix:** Decide and write: freeze RSVPs on `REGISTERED` with an admin unlock, or keep them live and add an "update registration" flow with a new snapshot (and optionally version history). Define the same for `CANCELLED`/`ARCHIVED`.

---

## R2.3 New Majors Introduced or Left by the Revision

1. **Carpooling is still advertise-only.** Decide whether matching ("who rides with whom") is in scope; if not, say so explicitly and remove the implication from the goals.
2. **`isPaid` can contradict its evidence.** `isPaid = true` with no `paidById`, `paidAt`, or `amountCents` is representable. Derive it or enforce the invariant in the service layer.
3. **No end-to-end registration freeze or update path.** Snapshot exists, but stale-roster behavior is undefined (see R2.2-5).
4. **`mailto:` body still hardcodes four players** (line 359) despite the goal saying "confirmed lineup". Generate bullets from the active lineup.
5. **Time is required by the schema but not by the required-field list.** `startsAt` is non-nullable; §7.2 only requires title/date/location/team size. Either require time or define an all-day fallback (which must be explicit, not midnight).
6. **Status/tab mapping is undefined.** `DRAFT` is never produced, `OPEN`/`REGISTERED` do not map clearly to *Gepland* / *In Beraad*, and "Archief" is neither `ARCHIVED` nor `startsAt < now` explicitly. `CANCELLED` vs "we decided not to go" is still conflated.
7. **Auth edge cases.** Public `/auth/join` and `/auth/login` contradict the blanket "every route without a session redirects"; session expiry after 90 days has no recovery path; deactivating a member does not revoke their sessions; the admin PIN has no stored unlock marker (`Session` has no `adminUnlockedAt`) or rate limit.
8. **iOS PWA session sharing is still asserted, not solved.** Adding to home screen after login does not guarantee the standalone PWA shares Safari's cookie jar. Provide an in-app token/paste entry path (the invite link can be opened inside the PWA) and test it.
9. **Two team-name sources.** `Team.name` defaults to "Ploeg 1"; §7.3 uses `TeamSetting.defaultTeamName`. Pick one authority and copy it at creation.
10. **Member deletion is impossible as written.** `Restrict` on `createdBy`/`registeredBy`/`paidBy` plus `@unique email` means hard delete fails and soft-deleted members block re-inviting the same email. Choose one of `isActive`/`deletedAt` and define the query convention.
11. **Admin RSVP override has no UI or audit.** The matrix grants it; no route or actor/reason field exists.
12. **Privacy/retention and operations remain unspecified.** Object-storage visibility, flyer retention, AI subprocessor note, backups, migrations, and a broader acceptance-criteria set.

**Minor:** `Session.@@index([token])` is redundant with `@unique`; `doorsOpenTime` is unused in calendar exports; `TeamSetting.contactEmail/contactPhone` are unreachable in the UI; `registrationSnapshot String?` would be better as `Json`; no `createdAt` on `QuizPayment`; no `updatedById` audit on admin edits; `UID: quiz-[id]@be-quiz.local` should use the real app domain; §7.5 mixes `%0A` and `%0D%0A`.

---

## R2.4 Updated Processing Order

1. Decide the two product questions below.
2. Fix R2.2-1 to R2.2-5 in the schema and prose.
3. Define one waitlist ordering key and one transaction strategy; expand the concurrency tests.
4. Complete the auth model: invite storage/rotation, admin unlock state, logout/revocation, deactivation, expiry recovery, public-route exceptions.
5. Add team creation + one-team invariant; reconcile or drop the multi-team claim.
6. Define the `QuizStatus` transition table and tab mapping.
7. Fix the registration body, guards, snapshot lifecycle, and time requirement.
8. Add privacy/retention, backup/restore, and a broader acceptance suite.
9. Re-run the builder check. Then approve and move to `writing-plans`.

## R2.5 Product Decisions Still Open

1. **Lineup after registration:** freeze on `REGISTERED` (admin unlock to change), or stay live with an explicit "update registration" action?
2. **Carpooling:** real driver↔passenger matching, or advertise seats only?
3. **Admin PIN scope:** gate all admin mutations, or only destructive ones (delete/archive/roster)? (Either is fine; the state and storage must be written down.)
4. **One team:** confirm v1 is exactly one team per quiz with no external guests, so the invariant can be enforced in the schema.
