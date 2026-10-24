# Design Document: Pub Quiz Coordination App (BE-Quiz)

**Date:** 2026-10-24  
**Status:** Approved Specification (Revised Round 3)  
**Target Path:** `docs/superpowers/specs/2026-10-24-quiz-coordination-app-design.md`

---

## 1. Intent & The "Why"

A private circle of friends in Flanders/Belgium regularly attends pub quizzes. Coordination is currently fragmented across three tools:
* **WhatsApp:** Quiz announcements posted as flyer photos; availability messages get buried in chat noise.
* **Email:** Registration sent to the organizer from personal email, often including entry fee info.
* **Google Calendar:** Manually updated with venue, time, attendees, and payment details.

This app unifies these steps into a single, mobile-optimized Progressive Web App (PWA):
1. Any member uploads a flyer image (or enters details manually).
2. AI extracts details; the user reviews and provides any missing required fields.
3. Friends RSVP with transactional capacity enforcement, automatic waitlisting, and promotion.
4. One tap generates a pre-filled registration email (`mailto:`) from the user's native mail client.
5. Record when the entry fee is paid and by whom.
6. One tap exports the event to calendar (.ics / Google Calendar) and shares formatted updates to WhatsApp.
7. Access is strictly private to the group.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
* **Flyer Intake & AI Extraction:** Extract quiz title, start date, start time, venue, team limit, organizer email, and advertised entry fee. If any required field (`title`, `startsAt`, `location`, `maxTeamSize`) is missing or ambiguous, prompt the user during review.
* **Manual Entry Path:** Full ability to add a quiz manually without a flyer image.
* **Strictly Members-Only Access:** All views and endpoints require authenticated member access via secure persistent session cookies. Unauthenticated visitors are redirected to sign-in.
* **Deterministic Waitlist & Promotion:** Maintain a strict FIFO queue based on a single `queuedSince` timestamp. When a lineup spot opens, the next reserve is promoted automatically.
* **Decoupled Team Structure:** Schema models a `Team` associated with the `Quiz` (constrained via `@@unique([quizId])` to 1 team in v1, but architected so multiple teams or guest players can be added in v2 without data migrations).
* **Native Mail Hand-Off:** Pre-fill the device's native mail client (`mailto:`) with organizer email, team name, and contact person. Roster and player count are intentionally excluded from the email.
* **Registration Independence:** A team can be registered at any time, independent of how many members have RSVP'd.
* **Minimal Payment Flag:** Single team payment record (paid flag derived from `paidAt != null`, and `paidById`).
* **Calendar Export:** Proper timezone-aware RFC 5545 `.ics` export and Google Calendar web link.
* **Mobile-First PWA:** Fast, responsive UI optimized for mobile devices, installable to iOS/Android home screens with an in-app invite claim fallback.

### Non-Goals
* **No Multi-Tenancy / Public SaaS:** Strictly scoped to this private group of friends.
* **No Public Share Pages:** Unauthenticated viewers cannot view quizzes or rosters in v1.
* **No In-App Payment Gateway:** Does not process Stripe or bank transfers; only records who fronted the fee.
* **No Automated Server Email Relay:** Does not send SMTP emails directly; relies on `mailto:` client drafts.
* **No Server Push Infrastructure:** Promotion alerts use one-tap WhatsApp sharing rather than Web Push / APNs.
* **No Two-Way Calendar Sync:** No background polling or sync back from Google Calendar.
* **No Hard Delete in v1:** Quizzes can only be cancelled or archived; member rosters are add-only.
* **No Carpooling in v1:** Ride sharing is deferred to v2.

### Anti-Goals
* **No Forgotten Password Friction:** Persistent signed cookies rather than complex password policies for regular members.
* **No Silent Defaults:** Do not guess missing dates, times, venues, or team sizes silently.
* **No App Store Review Hurdles:** PWA delivery only; zero app store fees.

---

## 3. Constraints & Operating Environment

* **Target Audience:** ~10-15 friends, participating in ~15-25 quizzes per year.
* **Language:** Dutch (`nl-BE`) for all user-facing UI and messages; English for database schema and code.
* **Platform:** Mobile-first web app (iOS Safari and Android Chrome PWA support).
* **Hosting & Portability:**
  * Production: Next.js on Vercel (serverless) or Fly.io (standalone Docker container in Brussels `bru` region).
  * Production Database: PostgreSQL (e.g. Supabase Frankfurt, Neon, or Fly Postgres).
  * Local Development: PostgreSQL via Docker Compose (`docker-compose up -d`).
  * Asset Storage: Object storage (Vercel Blob or S3-compatible bucket) with server-side validation and signed URLs.

---

## 4. User Roles & Authentication

### 4.1 Roles & Permissions Matrix

| Action | Regular Member (`USER`) | Administrator (`ADMIN`) |
|---|---|---|
| View quiz list & details | Allowed | Allowed |
| Upload flyer & verify on creation | Allowed | Allowed |
| Manual quiz creation | Allowed | Allowed |
| Edit quiz details post-creation | **Forbidden** | Allowed (requires confirmation) |
| Archive or cancel quiz | **Forbidden** | Allowed (requires confirmation) |
| RSVP for self (Attending / Declined) | Allowed | Allowed |
| Override another member's RSVP | **Forbidden** | Allowed (Decline-only, audited) |
| Trigger "Schrijf ploeg in" | Allowed | Allowed |
| Reset registration status | **Forbidden** | Allowed (requires confirmation) |
| Mark team fee as paid | Allowed (any member) | Allowed |
| Add new members & manage settings | **Forbidden** | Allowed |

### 4.2 Authentication & Session Flow
* **Member Seeding & Bootstrap:** An initial admin seed creates the initial member records (`name`, `role`). Each member has an `Invite` record with a high-entropy secret token (stored as a SHA-256 hash).
* **Invite Claiming:**
  * Member opens `/auth/join?token=<secret>`.
  * Alternatively, on `/auth/login`, members who installed the PWA first can paste their token into a manual input field.
  * Server verifies the hash, checks `usedAt == null` (and optional 30-day TTL), marks `usedAt = now()`, and issues a signed, `httpOnly`, `Secure`, `SameSite=Lax` session cookie with a 90-day expiry.
* **Session Management:**
  * Session token stored as a SHA-256 hash in `Session.tokenHash`.
  * Revocation / Logout: `/auth/logout` deletes the session from the database and clears the cookie.
  * Public routes: `/auth/login`, `/auth/join`, `/auth/logout`. All other routes require an active session.
* **Admin Authorization:**
  * Server-side check: `session.member.role === "ADMIN"`.
  * Destructive mutations (cancelling/archiving a quiz, resetting registration) require an explicit confirmation dialog on the client before submission.

---

## 5. Screen & Route Inventory

### 5.1 User Routes & Screens

1. **`/quizzes` (Timeline & Dashboard):**
   * Filter tabs (derived from `team.registeredAt` and `quiz.startsAt`):
     * **In Beraad:** Upcoming quizzes (`startsAt >= now()`) where `team.registeredAt == null` (gathering participants).
     * **Gepland:** Upcoming quizzes (`startsAt >= now()`) where `team.registeredAt != null` (officially registered).
     * **Archief:** Past quizzes (`startsAt < now()`), archived quizzes, or cancelled quizzes (badged with **Geannuleerd**).
   * Quiz cards display date, venue, player counts (*X / maxTeamSize*), payment badge, and registered status.
   * Floating Action Button: "+ Nieuwe Quiz".
2. **`/quizzes/new` (Flyer Upload & Entry Review):**
   * Tab 1: "Flyer Scannen" (camera/photo picker with client-side downscaling and HEIC conversion).
   * Tab 2: "Manueel Invoeren" (manual form).
   * AI Extraction Review Form: Title, Date, Time, Venue, Team Size, Entry Fee, Organizer Email, Registration URL.
   * Required fields (`title`, `date`, `time`, `location`, `maxTeamSize`) must be valid before the submit button is enabled.
3. **`/quizzes/[id]` (Quiz Detail & Actions):**
   * Flyer image preview (tap to expand in modal).
   * Date, start time, venue, advertised fee (`entryFee`), and notes.
   * **Mijn Deelname (RSVP):** Toggle buttons: "✓ Ik doe mee" / "Kan niet".
   * **Opstelling (Team Lineup):**
     * Active Lineup: Confirmed attendees (first `maxTeamSize` ordered by `queuedSince ASC`).
     * Reserve Lijst: Ordered waitlist (subsequent attendees by `queuedSince ASC`, showing position #1, #2, ...).
     * Promotion Banner: Displayed if a reserve was promoted ("Thomas is opgeroepen voor de ploeg!").
   * **Acties:**
     * "✉️ Schrijf Ploeg In" (opens `mailto:` or registration URL; available at any time, even with 0 RSVPs).
     * "💰 Inschrijvingsgeld" (toggle paid status; records current user and timestamp).
     * "💬 Deel op WhatsApp" (status summary + app link).
     * "📅 Toevoegen aan Agenda" (Google Calendar link & `.ics` download).
4. **`/quizzes/[id]/edit` (Admin Only):**
   * Edit venue, date/time, team size; cancel quiz; archive quiz; reset registration status.
5. **`/admin/members` (Admin Only):**
   * Add new member (name only); view and copy member invite links; regenerate invite tokens.
6. **`/admin/settings` (Admin Only):**
   * Configure default team name (e.g. "De Quizvrienden").
7. **`/auth/login`, `/auth/join`, `/auth/logout`:**
   * Login landing page, invite claim handler, and logout.

---

## 6. Data Model & Database Architecture

### 6.1 Prisma Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

enum Role {
  USER
  ADMIN
}

enum QuizStatus {
  OPEN
  CANCELLED
  ARCHIVED
}

enum RsvpStatus {
  ATTENDING
  DECLINED
}

model Member {
  id            String    @id @default(cuid())
  name          String
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())

  sessions      Session[]
  invite        Invite?
  rsvps         Rsvp[]
  quizzesCreated Quiz[]   @relation("QuizCreator")
  teamsRegistered Team[]  @relation("TeamRegistrar")
  teamsPaid     Team[]    @relation("TeamPayer")
  overridesGiven Rsvp[]   @relation("RsvpOverrider")
}

model Invite {
  id          String    @id @default(cuid())
  memberId    String    @unique
  member      Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique
  expiresAt   DateTime?
  usedAt      DateTime?
  createdAt   DateTime  @default(now())
}

model Session {
  id           String   @id @default(cuid())
  tokenHash    String   @unique
  memberId     String
  member       Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}

model Quiz {
  id              String      @id @default(cuid())
  title           String
  startsAt        DateTime    // UTC timestamp representing quiz start
  timeZone        String      @default("Europe/Brussels")
  durationMinutes Int         @default(180)
  location        String
  organizerEmail  String?
  registrationUrl String?
  entryFee        String?     // Display-only string from flyer (e.g. "€20 / ploeg")
  notes           String?
  flyerImageUrl   String?
  status          QuizStatus  @default(OPEN)

  createdById     String
  createdBy       Member      @relation("QuizCreator", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // 1-to-1 in v1, prepared for 1-to-many in v2
  team            Team?

  @@index([startsAt, status])
}

model Team {
  id              String      @id @default(cuid())
  quizId          String      @unique // Enforces exactly 1 team per quiz in v1
  quiz            Quiz        @relation(fields: [quizId], references: [id], onDelete: Cascade)
  name            String
  maxTeamSize     Int         @default(4)

  // Registration state
  registeredAt    DateTime?
  registeredById  String?
  registeredBy    Member?     @relation("TeamRegistrar", fields: [registeredById], references: [id], onDelete: Restrict)

  // Payment state
  paidAt          DateTime?
  paidById        String?
  paidBy          Member?     @relation("TeamPayer", fields: [paidById], references: [id], onDelete: Restrict)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  rsvps           Rsvp[]

  @@index([quizId])
}

model Rsvp {
  id              String      @id @default(cuid())
  teamId          String
  team            Team        @relation(fields: [teamId], references: [id], onDelete: Cascade)
  memberId        String
  member          Member      @relation(fields: [memberId], references: [id], onDelete: Restrict)

  status          RsvpStatus
  queuedSince     DateTime?   // Single timestamp tracking place in line

  // Admin decline audit
  overriddenById  String?
  overriddenBy    Member?     @relation("RsvpOverrider", fields: [overriddenById], references: [id], onDelete: Restrict)
  overriddenAt    DateTime?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([teamId, memberId])
  @@index([teamId, status, queuedSince])
}

model TeamSetting {
  id              String   @id @default("singleton")
  defaultTeamName String   @default("De Quizvrienden")
  updatedAt       DateTime @updatedAt
}
```

---

## 7. Core Logic & Invariants

### 7.1 Team Creation & Concurrency Control
* **Atomic Quiz & Team Creation:** When a quiz is created, a single transaction inserts the `Quiz` record and its associated `Team` record (setting `Team.name` from `TeamSetting.defaultTeamName` and `Team.maxTeamSize` from the form).
* **Concurrency Locking:** All RSVP updates and capacity adjustments run inside an interactive PostgreSQL transaction that acquires an exclusive row-level lock on the `Team`:
  ```sql
  SELECT * FROM "Team" WHERE id = $1 FOR UPDATE;
  ```

### 7.2 Single-Source Queue Ordering (`queuedSince`)
* **Transition to ATTENDING:**
  * Member sets status to `ATTENDING`.
  * Set `queuedSince = now()`, `overriddenById = null`, `overriddenAt = null`.
* **Deriving Active Lineup vs Reserve List:**
  * Query all RSVPs where `status = ATTENDING` ordered by `queuedSince ASC`.
  * **Active Lineup:** Items `[0 ... maxTeamSize - 1]`.
  * **Reserve List (Waitlist):** Items `[maxTeamSize ...]`.
  * Reserve queue position is purely derived from its 1-based index in the Reserve List.
* **Transition to DECLINED (or Admin Decline Override):**
  * Set `status = DECLINED`, `queuedSince = null`.
  * If triggered by admin: record `overriddenById = admin.id`, `overriddenAt = now()`.
  * Active lineup and reserve list recalculate automatically. The next member in line by `queuedSince ASC` is immediately in the active lineup.
* **Lowering `maxTeamSize`:**
  * If an admin lowers `maxTeamSize` from 5 to 4, the attendee with the latest `queuedSince` timestamp automatically shifts to reserve position #1 without resetting their original queue time.

### 7.3 Flyer Intake & Vision Extraction
* **Client-Side Preparation:**
  * Client converts HEIC/HEIF to JPEG via browser canvas / client library.
  * Image is scaled client-side to max 1600px width/height and compressed to JPEG.
* **Server-Side Validation & Extraction:**
  * Max size: 4MB. MIME check: `image/jpeg`, `image/png`, `image/webp`.
  * Stored in private object storage; client accesses via temporary signed URL.
  * Rate limit: 5 uploads per member per hour; global app limit: 20 extractions per day.
  * Timeout: 15 seconds. On timeout or 5xx, UI displays a friendly message and switches to manual entry.
  * Token and latency metrics logged for every extraction.
  * Mandatory fields check: `title`, `startsAt` (date and time), `location`, and `maxTeamSize`. If missing or low confidence, they are highlighted in red and must be completed by the user before saving.

### 7.4 Registration Email Hand-Off
* **Availability:** The "✉️ Schrijf Ploeg In" action is always available for an upcoming, open quiz, regardless of whether 0, 2, or 4 members have RSVP'd.
* **Email Client Hand-Off (`mailto:`):**
  * Tapping the button generates a percent-encoded `mailto:` URI using `%0D%0A` for newlines:
    * `to`: `Quiz.organizerEmail`
    * `subject`: `encodeURIComponent("Inschrijving quiz: " + quiz.title + " - " + team.name)`
    * `body`:
      ```text
      Beste organisatie,

      Graag schrijven wij onze ploeg in voor [quiz.title] op [datum om tijd]:

      Ploegnaam: [team.name]
      Contactpersoon: [currentMember.name]

      Met vriendelijke groeten,
      [currentMember.name]
      ```
    *(Note: Per Decision D2, player names and player counts are explicitly omitted from the registration email).*
  * Fallback button: "📋 Kopieer Email Tekst".
  * For online forms: "🌐 Open Inschrijvingsformulier" linking to `Quiz.registrationUrl`.
* **Registration Confirmation:**
  * A prompt asks: *"Heb je de inschrijving verzonden naar de organisatie?"*
  * On confirmation: sets `team.registeredAt = now()` and `team.registeredById = currentMember.id`.
  * The quiz immediately shifts from **In Beraad** to **Gepland**.
  * Admin can reset this flag back to null if it was clicked in error.

### 7.5 Payment Tracking
* **One-Tap Payment Toggle:**
  * On the quiz detail view: "Inschrijvingsgeld betaald: [ Ja / Nee ]".
  * Any member can tap "Markeer als betaald door mij".
  * Sets `team.paidAt = now()` and `team.paidById = currentMember.id`.
  * Anyone can see: *"💰 Inschrijvingsgeld betaald door Marc op 14/11"*.

### 7.6 Calendar Export & WhatsApp Sharing
* **Google Calendar URL (`action=TEMPLATE`):**
  * `text`: `encodeURIComponent(quiz.title)`
  * `dates`: `YYYYMMDDTHHmm00Z/YYYYMMDDTHHmm00Z` (computed from `startsAt` UTC + `durationMinutes`).
  * `location`: `encodeURIComponent(quiz.location)`
  * `details`: `encodeURIComponent("Ploeg: " + team.name + "\nBetaald: " + (team.paidAt ? "Ja" : "Nee"))`
* **RFC 5545 iCalendar (`.ics` Download):**
  * Endpoint `/api/quizzes/[id]/calendar.ics` returning `text/calendar; charset=utf-8`.
  * Compliant output: `UID: quiz-[id]@[APP_DOMAIN]`, `DTSTAMP`, `DTSTART`, `DTEND`, line-folding at 75 octets, CRLF line endings.
* **WhatsApp Share Button:**
  * `https://wa.me/?text=[encodedText]`
  * Formatted text:
    `🏆 Kwis: *[title]* op *[date]* om [time] te [location]!%0D%0APloeg: [team.name]%0D%0ABekijk & stem af via: [appUrl]/quizzes/[id]`

---

## 8. Deployment, Security & Operations

### 8.1 Runtime & Deployment
* **Vercel Target:** Serverless Next.js deployment.
* **Docker Standalone Target:** Multi-stage `Dockerfile` with Alpine Node runner and `linux-musl-openssl-3.0.x` Prisma binaries. Deployable to Fly.io Brussels `bru` region or any Linux VPS.
* **Database Connection:** PostgreSQL connection string via standard `DATABASE_URL` (with connection pooling enabled via pgbouncer/pooling).

### 8.2 Privacy & Retention
* **Flyer Retention:** Flyer images in object storage are automatically deleted 90 days after the quiz date.
* **Subprocessor Note:** Vision API calls (Anthropic / OpenAI) process images via stateless zero-data-retention endpoints.
* **Backups:** Automated daily PostgreSQL logical backups via provider tooling.

---

## 9. Definition of Done & Acceptance Criteria

1. **Zero-RSVP Registration Test:** Verify that "Schrijf ploeg in" is clickable and generates the correct email even when 0 players have RSVP'd.
2. **Email Content Test:** Verify that the generated email subject and body contain only the team name, quiz title, date, and contact person, with no attendee list or player counts.
3. **Capacity & Waitlist FIFO Test:** Given `maxTeamSize = 4`, when 5 members RSVP, the first 4 by `queuedSince` are active and the 5th is reserve #1.
4. **Promotion Test:** When an active attendee changes to DECLINED (or is overridden by an admin), the reserve player with earliest `queuedSince` immediately becomes active.
5. **Timeline Tabs Test:** Verify that an upcoming quiz with `registeredAt == null` appears under **In Beraad**, shifts to **Gepland** when registered, and appears under **Archief** (with a "Geannuleerd" badge) if cancelled.
6. **Payment Flag Test:** Verify that any member can mark the fee as paid, setting `paidAt` and `paidById`.
7. **PWA In-App Invite Claim Test:** Verify that a user accessing `/auth/login` inside an installed PWA can paste their invite token to establish a valid 90-day session.
8. **AI Timeout & Failure Test:** Verify that when the vision API times out (>15s) or returns 5xx, the app switches cleanly to the manual entry form with an explanatory notification.
9. **Concurrency Test:** Two concurrent RSVPs submitted when 1 spot remains must acquire the row lock on `Team` sequentially, resulting in exactly 1 active attendee and 1 reserve.
