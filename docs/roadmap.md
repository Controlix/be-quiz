# Pub Quiz App (BE-Quiz) — Roadmap & Feature Backlog

**Current App Version:** `v2.5.0` (Guest Players)  
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

## Prioritized Backlog by Business & Operational Value

To maximize development impact and protect service stability, backlog items across Part 1 and Part 2 are ranked from highest to lowest value based on operational risk, real-world team workflow, game-night utility, ergonomics, and visual polish.

### Value Ranking Summary

| Rank   | Item                                                                                                                        | Category          | Key Benefit                                               |
| :----- | :-------------------------------------------------------------------------------------------------------------------------- | :---------------- | :-------------------------------------------------------- |
| **1**  | **[#12 Vercel Storage Optimization](#12-vercel-functions-storage--serverless-bundle-optimization)**                         | Infrastructure    | Prevents deployment failure at 74% storage limit          |
| **2**  | **[#1 Admin Edit Quiz Details](#1-admin-edit-quiz-details-error-correction)**                                               | Core Admin        | Eliminates manual database surgery for typos              |
| **3**  | **[#10 Admin Direct Member Enrollment](#10-admin-direct-member-lineup-enrollment-non-responding-members)**                  | Team Operations   | Captain can add players confirming via WhatsApp           |
| **4**  | **[#4 Direct Registration Toggle](#4-direct-registration-toggle-without-email)**                                            | Team Operations   | Accurate registration tracking without email clients      |
| **5**  | **[#3 Venue Maps Integration](#3-venue-maps-integration--navigation)**                                                      | Player Experience | 1-tap route navigation on quiz night                      |
| **6**  | **[#8 Quiz Start Lockdown](#8-quiz-start-lockdown--historical-immutability)**                                               | Data Integrity    | Freezes lineups & RSVPs once quiz starts (Spec ready)     |
| **7**  | **[#7 Duplicate Quiz Detection](#7-duplicate-quiz-detection-on-entry)**                                                     | Data Hygiene      | Prevents split RSVPs and duplicate events                 |
| **8**  | **[#B.4 Multiple Teams per Quiz](#b-teams--headcount)**                                                                     | Team Operations   | Allows fielding 2 teams when 8 people sign up             |
| **9**  | **[#6 Date & Time Input Picker](#6-date--time-input-flexibility-calendar-picker--time-selector)**                           | Admin Ergonomics  | Eliminates manual typing of dates/times on mobile         |
| **10** | **[#13 Responsive Tablet & Rotation Layout](#13-responsive-tablet--smartphone-rotation-layout-optimization-pwa-landscape)** | UX / Responsive   | Optimizes screen usage on tablets and rotated smartphones |
| **11** | **[#C.6 Secure PIN Storage Upgrade](#c-member-management--security)**                                                       | Security          | Replaces unsalted SHA-256 with salted/bcrypt hash         |
| **12** | **[#C.7 / C.8 Member Soft-Delete & Details](#c-member-management--security)**                                               | Admin Management  | Clean roster management without breaking history          |
| **13** | **[#A.2 Public Share Preview](#a-integrations--logistics)**                                                                 | Growth / Subbing  | Shareable preview link for WhatsApp group chats           |
| **14** | **[#5 WhatsApp Share for Invites](#5-whatsapp-share-for-member-invites)**                                                   | Admin Ergonomics  | 1-tap invite link sharing via WhatsApp                    |
| **15** | **[#E.13 Dependabot Grouping Config](#e-cicd--dependency-automation-infrastructure)**                                       | CI / CD           | Stops failing Prisma 7 / TS 7 Dependabot PRs              |
| **16** | **[#C.9 Hard Delete with Confirmation](#c-member-management--security)**                                                    | Admin Utility     | Permanent removal of test/erroneous entries               |
| **17** | **[#9 Dynamic Browser Tab Title](#9-dynamic-browser-tab-title-team-name-synchronization)**                                  | Bugfix / Cosmetic | Injects custom team name into page `<title>`              |
| **18** | **[#11 Fractional Star Rating](#11-read-only-fractional-star-rating-component)**                                            | Visual Polish     | Clipped SVG decimal stars (Spec ready)                    |
| **19** | **[#2 Dynamic Capacity Icon](#2-dynamic-capacity-icon-for-player-count)**                                                   | Visual Polish     | Dynamic icon alongside player ratio                       |
| **20** | **[#A.1 Carpooling & Ride-Sharing](#a-integrations--logistics)**                                                            | Feature           | Complex; already handled organically in WhatsApp          |
| **21** | **[#D.12 Smart Historical Suggestion](#d-post-quiz-evaluation--historical-insights)**                                       | Insights          | Suggests past ratings on entry (Deferred)                 |

### Tier Breakdown

- **Tier 1: Critical Operational & Infrastructure Blockers (Ranks 1–3)**
  - Urgent technical debts or missing core administrative controls that risk platform stability or require direct database intervention.
- **Tier 2: Real-World Workflow & Team Operations (Ranks 4–7)**
  - High-frequency friction reducers that reflect how pub quiz teams actually register, travel, and finalize lineups.
- **Tier 3: Core Mobile & Admin Quality of Life (Ranks 8–13)**
  - Major ergonomic, responsive layout, security, and team capacity upgrades that simplify season-long management.
- **Tier 4: Quick Wins & Dependency Hygiene (Ranks 14–17)**
  - Minor functional bugfixes and configuration tuning with straightforward implementation paths.
- **Tier 5: Visual Polish & Deferred Features (Ranks 18–21)**
  - Aesthetic enhancements or speculative features where existing habits (e.g. WhatsApp chats) already suffice.

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

### 8. Quiz Start Lockdown & Historical Immutability

- **Status:** `[ ] Spec Ready: [docs/superpowers/specs/2026-11-08-quiz-start-lockdown-design.md](superpowers/specs/2026-11-08-quiz-start-lockdown-design.md)`
- **Feedback:** When a quiz has started or ended, the lineup and details should be fixed to preserve historical records and prevent accidental changes.
- **Requirement:**
  - Automatically freeze RSVPs, roster lineup ordering, and metadata changes for regular users once `startsAt` has arrived.
  - Administrators retain full override capabilities at all times.
  - Dynamically enforce in domain services and server actions without requiring schema migrations or cron runners.
  - Display clear read-only status indicators in the lineup and detail view for non-admins.
- **Scope:** `src/lib/quizLock.ts`, `rsvpService.ts`, `QuizDetailClient.tsx`, `TeamLineup.tsx`, and `ActionToolbar.tsx`.

### 9. Dynamic Browser Tab Title (Team Name Synchronization)

- **Status:** `[ ] Open`
- **Source:** In-App Bug Report (`cmw6kdgcw0001l2086ji24qle`)
- **Feedback:** The browser tab title still displays the hardcoded default `"KwisVrienden"` instead of the custom team name configured in `/admin/settings` (`TeamSetting.defaultTeamName`).
- **Requirement:**
  - Dynamically inject the configured team name into the browser document title / Next.js metadata (`src/app/layout.tsx`).
  - Fall back cleanly to the default team name if not configured.
- **Scope:** `src/app/layout.tsx` and team settings resolver.

### 10. Admin Direct Member Lineup Enrollment (Non-Responding Members)

- **Status:** `[ ] Open`
- **Source:** In-App Suggestion (`cmwewq4mh0001l508oh0j4180`)
- **Feedback:** Admins can only override RSVPs for members who have already responded or add external guests, but cannot directly enroll registered team members who haven't responded in the app yet (e.g. when confirmed via WhatsApp or in person).
- **Requirement:**
  - On the quiz detail view (`/quizzes/[id]`), provide an admin control (e.g. "+ Speler toevoegen" picker) listing team members who have not yet responded for this quiz.
  - Adding a member creates an `ATTENDING` RSVP on their behalf and immediately places them into the lineup or reserve bench adhering to standard capacity and timestamp ordering.
- **Scope:** `QuizDetailClient.tsx`, `TeamLineup.tsx`, `rsvpService.ts`, and server action `adminEnrollMemberAction`.

### 11. Read-Only Fractional Star Rating Component

- **Status:** `[ ] Spec Ready: [docs/superpowers/specs/2026-11-15-fractional-star-rating-design.md](superpowers/specs/2026-11-15-fractional-star-rating-design.md)`
- **Feedback:** Aggregate post-quiz ratings calculate decimal scores (e.g. `4.35` / 5), but read-only star displays currently lack continuous decimal precision.
- **Requirement:**
  - Render arbitrary decimal ratings by layering a percentage-clipped foreground star over a full-width background star.
  - Pure SVG + Tailwind implementation avoiding dynamic JIT class compilation issues and SVG squishing.
  - Integrate into `QuizRatingWidget.tsx` (team score footer & visitor view) and `QuizCard.tsx`.
- **Scope:** `src/components/ReadOnlyStarRating.tsx`, `QuizRatingWidget.tsx`, `QuizCard.tsx`.

### 12. Vercel Functions Storage & Serverless Bundle Optimization

- **Status:** `[ ] Plan Ready: [docs/superpowers/plans/2026-11-15-vercel-storage-optimization.md](superpowers/plans/2026-11-15-vercel-storage-optimization.md)`
- **Problem / Evidence:**
  - Vercel Functions Storage usage has reached **7.42 GB / 10 GB (74%)** across `be-quiz` and `be-quiz-2`, approaching the Hobby plan ceiling.
  - Each deployment packages **17 serverless function bundles** (11 pages, 5 API routes, 1 middleware), each weighing **~42.4 MB to 43.0 MB compressed (~101 MB uncompressed)**.
  - A single deployment consumes **~729 MB** of Functions Storage, meaning retaining just ~10 builds exceeds 7.4 GB.
- **Root Cause:**
  - Next.js output file tracing copies shared heavy server packages redundantly into every single route bundle independently.
  - Full Node.js runtime middleware (`/_middleware`) deploys across all regions with heavy imports (~42.4 MB).
  - Unconstrained deployment retention retains older preview and errored builds.
- **Action Plan:**
  1. **Immediate Dashboard Cleanup:** Tighten retention policies (previews: 1–3 days, canceled/errored: 1 day, prod: 7–14 days), delete old previews, and retire/clean up superseded `be-quiz-2` project.
  2. **Audit Output Tracing:** Inspect `.next/server/**/*.nft.json` locally using production build or bundle analyzer to locate the oversized dependency tree.
  3. **Build & Config Optimization (`next.config.ts`):** Apply `outputFileTracingExcludes` and `serverExternalPackages` for heavy server libraries; streamline middleware to avoid pulling database/auth SDKs into the edge routing layer.
- **Scope:** Vercel project settings, `next.config.ts`, `src/proxy.ts` / middleware.

### 13. Responsive Tablet & Smartphone Rotation Layout Optimization (PWA Landscape)

- **Status:** `[ ] Open`
- **Source:** User Feedback Intake (`[docs/superpowers/feedback/inbox/2026-11-15-tablet-responsive-screen-optimization.md](superpowers/feedback/inbox/2026-11-15-tablet-responsive-screen-optimization.md)`)
- **Feedback:** When rotating a smartphone to landscape or viewing the app on a tablet (iPad, Android tablet), the single-column portrait layout underutilizes screen space with excessive vertical scrolling and wide empty margins.
- **Requirement:**
  - Adapt `/quizzes` card lists to responsive multi-column grids (`md:grid-cols-2`, `lg:grid-cols-3`) on tablet and landscape screens.
  - Adapt `/quizzes/[id]` to a responsive split-view on wider screens (e.g. side-by-side quiz overview/actions and team lineup/reserve roster).
  - Optimize sticky headers, action toolbars, and modal dialogs for constrained viewport heights in landscape mode (`landscape:` or `max-h` CSS utilities).
  - Verify PWA manifest settings (`manifest.json` / Next.js metadata) support natural rotation (`"orientation": "any"` or `"natural"`).
- **Scope:** `src/app/layout.tsx`, `QuizCard.tsx`, `QuizDetailClient.tsx`, `TeamLineup.tsx`, `manifest.json`.

---

## Part 2: v2 Major Feature & Architecture Backlog

### A. Integrations & Logistics

1. **Carpooling & Ride-Sharing:** Allow members to indicate if they can drive (with seat counts) and assign passengers to cars, replacing ride discussions in WhatsApp.
2. **Public / Unauthenticated Share Preview:** A minimal read-only preview link for WhatsApp so non-members can view public event details (date, venue, spots left) without seeing personal friend rosters or requiring a login.

### B. Teams & Headcount

4. **Multiple Teams per Quiz (e.g. Team A / Team B):** When more friends want to join than the maximum team limit (e.g. 8 people for a 4-person quiz), allow fielding a second team instead of putting everyone on reserve. _(The schema already decouples `Team` from `Quiz` to make this seamless)._

### C. Member Management & Security

6. **Secure PIN Storage Upgrade & Seamless Migration (Bcrypt / Salted Hash):**
   - Upgrade PIN hashing from unsalted SHA-256 to a secure, brute-force-resistant mechanism (e.g. `bcrypt` or per-user salted hashing) so that 4-digit PINs cannot be precomputed or looked up via rainbow tables if database access is ever compromised.
   - Provide a seamless migration (precomputing existing hashes or migrating on login) so no PINs are invalidated and zero users are disrupted.
7. **Member Deactivation / Soft-Delete:** Ability for an admin to deactivate or archive departed members without corrupting historical quiz records.
8. **Member Contact Details & Editing:** Ability to add email addresses, phone numbers, and edit member names post-creation.
9. **Hard Delete with Confirmation:** A permanent deletion action for quizzes created entirely by mistake (as opposed to cancelling/archiving).

### D. Post-Quiz Evaluation & Historical Insights

12. **Smart Historical Suggestion When Entering a New Quiz:**
    - **Status:** `[ ] Open (Deferred / Future Backlog)`
    - When an admin scans a flyer or types in a quiz title and location (e.g. _"Den Dries Kwies 4"_), the system automatically checks whether the team has participated in prior editions in past years.
    - **Immediate Context on the Entry Screen:**
      - _"💡 You previously participated in this quiz! Previous rating: ⭐⭐⭐⭐☆ (4/5)"_
    - Provides immediate decision support when deciding whether to add and register for a recurring annual pub quiz.

### E. CI/CD & Dependency Automation Infrastructure

13. **Dependency Automation & Major Upgrade Strategy (Prisma 7 & TypeScript 7):**
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
