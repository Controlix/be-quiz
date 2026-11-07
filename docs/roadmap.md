# Pub Quiz App (BE-Quiz) — Roadmap & Feature Backlog

**Current App Version:** `v2.2.0` (Opportunistic Storage Garbage Collection)  
This document is the **single source of truth for active and planned roadmap items**. For past releases and completed milestone notes, see [CHANGELOG.md](../CHANGELOG.md) and [Feedback Archives](superpowers/feedback/).

---

## Guiding Principle: Mobile Player Experience vs. Desktop Admin Back-Office

- **Flyer Upload (Core Web App Feature):**
  - Flyer upload (AI Vision scanning, drag-and-drop, clipboard paste, and mobile camera/gallery upload) is and remains a core, first-class feature in the web application on both mobile and desktop.
- **Mobile Focus (Team Players):**
  - The mobile web experience is optimized for fast, thumb-friendly interaction for quiz team members.
  - Core actions: viewing upcoming quizzes, RSVPing (_"Ik doe mee"_ / _"Ik pas"_), seeing team lineups & reserves, quick WhatsApp sharing, 1-tap native calendar sync, snapping/uploading flyers, and a simple floating feedback submission tool.
  - Keeps the mobile UI lightweight, clean, and distraction-free without complex administrative overhead.
- **Desktop Focus (Admin & Back-Office):**
  - Heavy administrative tasks are naturally suited for a desktop browser with keyboard and larger screen space.
  - Desktop actions: detailed quiz entry and editing, bulk flyer upload analysis, member roster management & role assignments, reviewing user-submitted feedback and screenshots, and configuring shared team calendars or settings.

---

## Part 1: Active Priorities & v1.1 Polish

### 1. Admin Edit Quiz Details (Error Correction)

- **Status:** `[ ] Open`
- **Feedback:** If a user makes a mistake during manual entry or flyer scan (e.g. incorrect venue, wrong start time, typo in title), admins cannot fix it without direct database intervention.
- **Requirement:** Extend `/quizzes/[id]/edit` (restricted to admins) to allow updating all quiz metadata:
  - Title, date, start time, location/venue, entry fee, organizer email, registration URL, and notes.
- **Scope:** `EditQuizClient.tsx`, `quizService.ts`, and a new server action `adminUpdateQuizDetailsAction`.

### 2. Dynamic Capacity Icon for Player Count

- **Status:** `[ ] Open`
- **Feedback:** The static group icon (`👥`) doesn't give an immediate visual hint on whether a quiz is full or still seeking players.
- **Requirement:**
  - Dynamically update the icon displayed alongside the player ratio (`attending / max`, e.g. on quiz cards and headers):
    - **Full / Complete:** Display a full/complete indicator (e.g. `UserCheck` or checkmark badge).
    - **Open / Seeking:** Display an open/seeking indicator (e.g. `UserPlus` or `Users` with spots remaining).
- **Scope:** `QuizCard.tsx` and `TeamLineup.tsx`.

### 3. Venue Maps Integration & Navigation

- **Status:** `[ ] Open`
- **Feedback:** Users have to manually copy-paste the venue address into their navigation app.
- **Requirement:** Tapping the venue/address on quiz cards or detail views opens Google Maps / Apple Maps / Waze with direct route navigation.
- **Scope:** `QuizCard.tsx` and `QuizDetailClient.tsx`.

### 4. Direct Registration Toggle (Without Email)

- **Status:** `[ ] Open`
- **Feedback:** Not all pub quizzes require or offer email registration; some are registered on Facebook, by phone, or in person.
- **Requirement:** Provide a direct _"Markeer als ingeschreven"_ button alongside the mailto flow so an admin or player can mark the team as officially registered without opening an email client.
- **Scope:** `ActionToolbar.tsx` and registration server actions.

### 5. WhatsApp Share for Member Invites

- **Status:** `[ ] Open`
- **Feedback:** Copying invite links manually is tedious when onboarding friends via WhatsApp.
- **Requirement:** In `/admin/members` (when adding a member or viewing an active invite link), provide a direct 1-tap "Deel via WhatsApp" button that pre-fills a friendly greeting and their join link.
- **Scope:** `/admin/members` management screen.

### 6. Date & Time Input Flexibility (Calendar Picker & Time Selector)

- **Status:** `[ ] Open`
- **Feedback:** Typing dates manually in `DD/MM/YYYY` format can be slow on mobile.
- **Requirement:**
  - Support both typing the date directly and tapping a calendar icon/button to open an interactive visual date picker.
  - Provide an easy time selection mechanism alongside text entry (e.g. native time picker dropdown or quick preset buttons like `19:30`, `20:00`, `20:30`, `14:00`).
- **Scope:** `QuizEntryForm.tsx` and `EditQuizClient.tsx`.

### 7. Duplicate Quiz Detection on Entry

- **Status:** `[ ] Open`
- **Feedback:** Accidental duplicate quizzes can split RSVPs and cause confusion.
- **Requirement:** Warn the user when creating a quiz if another quiz already exists on the same date or at the same venue.
- **Scope:** `QuizEntryForm.tsx` and `quizService.ts`.

---

## Part 2: v2 Major Feature & Architecture Backlog

### A. Integrations & Logistics

1. **Carpooling & Ride-Sharing:** Allow members to indicate if they can drive (with seat counts) and assign passengers to cars, replacing ride discussions in WhatsApp.
2. **Public / Unauthenticated Share Preview:** A minimal read-only preview link for WhatsApp so non-members can view public event details (date, venue, spots left) without seeing personal friend rosters or requiring a login.

### B. Teams & Headcount

4. **Multiple Teams per Quiz (e.g. Team A / Team B):** When more friends want to join than the maximum team limit (e.g. 8 people for a 4-person quiz), allow fielding a second team instead of putting everyone on reserve. _(The schema already decouples `Team` from `Quiz` to make this seamless)._
5. **Guest Players:** Ability to add an external guest or partner to the lineup who is not an official registered app member.

### C. Member Management & Security

6. **Secure PIN Storage Upgrade & Seamless Migration (Bcrypt / Salted Hash):**
   - Upgrade PIN hashing from unsalted SHA-256 to a secure, brute-force-resistant mechanism (e.g. `bcrypt` or per-user salted hashing) so that 4-digit PINs cannot be precomputed or looked up via rainbow tables if database access is ever compromised.
   - Provide a seamless migration (precomputing existing hashes or migrating on login) so no PINs are invalidated and zero users are disrupted.
7. **Member Deactivation / Soft-Delete:** Ability for an admin to deactivate or archive departed members without corrupting historical quiz records.
8. **Member Contact Details & Editing:** Ability to add email addresses, phone numbers, and edit member names post-creation.
9. **Admin Role Management (Promote / Demote):** Interactive buttons in `/admin/members` to promote members to `ADMIN` or demote an Admin back to `USER` (with self-demotion protection).
10. **Hard Delete with Confirmation:** A permanent deletion action for quizzes created entirely by mistake (as opposed to cancelling/archiving).

### D. Post-Quiz Evaluation & Historical Insights

11. **Lightweight Quiz Rating (1 to 5 Stars/Smileys) & Historical Match on Entry:**
    - **Simplicity & Zero Overhead:**
      - Once a quiz has ended (date and start time passed), participating team members can quickly rate the quiz on a **1 to 5 scale (stars or smileys)**: how enjoyable was the event?
      - No cumbersome questionnaires or forms: a single tap records the team's impression.
    - **Smart Historical Suggestion When Entering a New Quiz:**
      - When an admin scans a flyer or types in a quiz title and location (e.g. _"Den Dries Kwies 4"_), the system automatically checks whether the team has participated in prior editions in past years.
      - **Immediate Context on the Entry Screen:**
        - _"💡 You previously participated in this quiz! Previous rating: ⭐⭐⭐⭐☆ (4/5)"_
      - Provides immediate decision support when deciding whether to add and register for a recurring annual pub quiz.

### E. CI/CD & Dependency Automation Infrastructure

12. **Dependency Automation & Major Upgrade Strategy (Prisma 7 & TypeScript 7):**
    - **Status:** `[ ] Open`
    - **Problem / Observed Evidence:** Automated Dependabot PRs for major dependency bumps fail deployment and build checks:
      - **Prisma 7 (`PR #13`, `PR #7`):** Fails Vercel deployment with `Error code: P1012: The datasource property 'url' is no longer supported in schema files`. Dependabot decoupled `prisma` from `@prisma/client`, causing engine version mismatches and failing on Prisma 7's breaking schema architecture.
      - **TypeScript 7 (`PR #11`):** Fails `npm install` due to a strict peer dependency conflict with `typescript-eslint@8.x` (`peer typescript@">=4.8.4 <6.1.0"`).
    - **Root Cause:** `.github/dependabot.yml` currently runs unconstrained weekly updates without grouping related packages together or ignoring major breaking version jumps that require deliberate codebase refactoring.
    - **Requirement:**
      1. **Dependabot Configuration Polish:** Update `.github/dependabot.yml` to:
         - Group `prisma` and `@prisma/client` together so they are never bumped out of sync.
         - Configure `ignore` rules for major upgrades of ecosystem-sensitive packages (like `prisma` and `typescript`) until they are intentionally scheduled for migration.
      2. **Planned Prisma 7 Migration (When Scheduled):** When ready to adopt Prisma 7, perform a coordinated migration:
         - Upgrade both `prisma` and `@prisma/client` together.
         - Migrate database connection URLs out of `schema.prisma` into `prisma.config.ts`.
         - Configure driver adapters (e.g. `@prisma/adapter-pg`) in `src/lib/prisma.ts`.
      3. **TypeScript 7 Ecosystem Alignment:** Defer upgrading to TypeScript 7 until `@typescript-eslint` and Next.js release official peer support.
