# Pub Quiz App (BE-Quiz) — Roadmap & Feature Backlog

**Current App Version:** `v1.1.0` (Modular Core & Decoupled Integrations)  
This document is the **single source of truth for active and planned roadmap items**. For past releases and completed milestone notes, see [CHANGELOG.md](../CHANGELOG.md) and [Feedback Archives](superpowers/feedback/).

---

## Guiding Principle: Mobile Player Experience vs. Desktop Admin Back-Office
* **Flyer Upload (Core Web App Feature):**
  * Flyer upload (AI Vision scanning, drag-and-drop, clipboard paste, and mobile camera/gallery upload) is and remains a core, first-class feature in the web application on both mobile and desktop.
* **Mobile Focus (Team Players):**
  * The mobile web experience is optimized for fast, thumb-friendly interaction for quiz team members.
  * Core actions: viewing upcoming quizzes, RSVPing (*"Ik doe mee"* / *"Ik pas"*), seeing team lineups & reserves, quick WhatsApp sharing, 1-tap native calendar sync, snapping/uploading flyers, and a simple floating feedback submission tool.
  * Keeps the mobile UI lightweight, clean, and distraction-free without complex administrative overhead.
* **Desktop Focus (Admin & Back-Office):**
  * Heavy administrative tasks are naturally suited for a desktop browser with keyboard and larger screen space.
  * Desktop actions: detailed quiz entry and editing, bulk flyer upload analysis, member roster management & role assignments, reviewing user-submitted feedback and screenshots, and configuring shared team calendars or settings.

---

## Part 1: Active Priorities & v1.1 Polish

### 1. Orphaned Uploads & Storage Garbage Collection (Storage Leak)
* **Status:** `[ ] Open / Ready to Plan`
* **Problem / Feedback:** When users drop, upload, or paste a flyer in `FlyerUploader` but do not submit/save the quiz (or upload multiple images while testing), files are immediately written to storage and never deleted.
* **Observed Evidence:**
  * **Locally:** 22 out of 27 files in `public/uploads/` were unreferenced orphans before being pruned.
  * **Production (Vercel Blob):** In `be-quiz-blob`, 22 out of 24 files (totaling 4.17 MB) are unreferenced orphans, while the production database only has 2 active quiz flyer URLs.
* **Root Cause:** Eager upload on file selection writes directly to storage before quiz submission, with zero cleanup or TTL garbage collection for unreferenced files.
* **Requirement:**
  1. **Dual Storage Pruning:** Extend the prune service to support both local filesystem (`public/uploads`) and cloud storage (`@vercel/blob` via `list()` and `del()`).
  2. **Safe Retention Window (TTL):** Delete only files that are **unreferenced in the database AND older than 24 hours** (ensuring in-progress quiz creation forms are never interrupted).
  3. **Automated Maintenance Execution:** Expose an authenticated cron route (e.g. `GET /api/cron/prune-uploads` secured by `CRON_SECRET`) for Vercel Cron, alongside the `npm run prune-uploads` CLI script.

### 2. Admin Edit Quiz Details (Error Correction)
* **Status:** `[ ] Open`
* **Feedback:** If a user makes a mistake during manual entry or flyer scan (e.g. incorrect venue, wrong start time, typo in title), admins cannot fix it without direct database intervention.
* **Requirement:** Extend `/quizzes/[id]/edit` (restricted to admins) to allow updating all quiz metadata:
  * Title, date, start time, location/venue, entry fee, organizer email, registration URL, and notes.
* **Scope:** `EditQuizClient.tsx`, `quizService.ts`, and a new server action `adminUpdateQuizDetailsAction`.

### 3. Dynamic Capacity Icon for Player Count
* **Status:** `[ ] Open`
* **Feedback:** The static group icon (`👥`) doesn't give an immediate visual hint on whether a quiz is full or still seeking players.
* **Requirement:**
  * Dynamically update the icon displayed alongside the player ratio (`attending / max`, e.g. on quiz cards and headers):
    * **Full / Complete:** Display a full/complete indicator (e.g. `UserCheck` or checkmark badge).
    * **Open / Seeking:** Display an open/seeking indicator (e.g. `UserPlus` or `Users` with spots remaining).
* **Scope:** `QuizCard.tsx` and `TeamLineup.tsx`.

### 4. Venue Maps Integration & Navigation
* **Status:** `[ ] Open`
* **Feedback:** Users have to manually copy-paste the venue address into their navigation app.
* **Requirement:** Tapping the venue/address on quiz cards or detail views opens Google Maps / Apple Maps / Waze with direct route navigation.
* **Scope:** `QuizCard.tsx` and `QuizDetailClient.tsx`.

### 5. Direct Registration Toggle (Without Email)
* **Status:** `[ ] Open`
* **Feedback:** Not all pub quizzes require or offer email registration; some are registered on Facebook, by phone, or in person.
* **Requirement:** Provide a direct *"Markeer als ingeschreven"* button alongside the mailto flow so an admin or player can mark the team as officially registered without opening an email client.
* **Scope:** `ActionToolbar.tsx` and registration server actions.

### 6. WhatsApp Share for Member Invites
* **Status:** `[ ] Open`
* **Feedback:** Copying invite links manually is tedious when onboarding friends via WhatsApp.
* **Requirement:** In `/admin/members` (when adding a member or viewing an active invite link), provide a direct 1-tap "Deel via WhatsApp" button that pre-fills a friendly greeting and their join link.
* **Scope:** `/admin/members` management screen.

### 7. Date & Time Input Flexibility (Calendar Picker & Time Selector)
* **Status:** `[ ] Open`
* **Feedback:** Typing dates manually in `DD/MM/YYYY` format can be slow on mobile.
* **Requirement:**
  * Support both typing the date directly and tapping a calendar icon/button to open an interactive visual date picker.
  * Provide an easy time selection mechanism alongside text entry (e.g. native time picker dropdown or quick preset buttons like `19:30`, `20:00`, `20:30`, `14:00`).
* **Scope:** `QuizEntryForm.tsx` and `EditQuizClient.tsx`.

### 8. Duplicate Quiz Detection on Entry
* **Status:** `[ ] Open`
* **Feedback:** Accidental duplicate quizzes can split RSVPs and cause confusion.
* **Requirement:** Warn the user when creating a quiz if another quiz already exists on the same date or at the same venue.
* **Scope:** `QuizEntryForm.tsx` and `quizService.ts`.

---

## Part 2: v2 Major Feature & Architecture Backlog

### A. Integrations & Logistics
1. **Shared Team Google Calendar (Google Cloud):**
   * Replace the individual "Add to my Google Calendar" button with direct integration to the team's shared Google Calendar in Google Cloud.
   * Scheduled quizzes are automatically pushed to, updated, or removed from the shared team calendar (via Google Calendar API / Service Account and Shared Calendar ID).
   * Optional live `webcal://` feed URL for native Apple/Android calendar subscriptions.
2. **Carpooling & Ride-Sharing:** Allow members to indicate if they can drive (with seat counts) and assign passengers to cars, replacing ride discussions in WhatsApp.
3. **Public / Unauthenticated Share Preview:** A minimal read-only preview link for WhatsApp so non-members can view public event details (date, venue, spots left) without seeing personal friend rosters or requiring a login.

### B. Teams & Headcount
4. **Multiple Teams per Quiz (e.g. Team A / Team B):** When more friends want to join than the maximum team limit (e.g. 8 people for a 4-person quiz), allow fielding a second team instead of putting everyone on reserve. *(The schema already decouples `Team` from `Quiz` to make this seamless).*
5. **Guest Players:** Ability to add an external guest or partner to the lineup who is not an official registered app member.

### C. Member Management & Security
6. **Secure PIN Storage Upgrade & Seamless Migration (Bcrypt / Salted Hash):**
   * Upgrade PIN hashing from unsalted SHA-256 to a secure, brute-force-resistant mechanism (e.g. `bcrypt` or per-user salted hashing) so that 4-digit PINs cannot be precomputed or looked up via rainbow tables if database access is ever compromised.
   * Provide a seamless migration (precomputing existing hashes or migrating on login) so no PINs are invalidated and zero users are disrupted.
7. **Member Deactivation / Soft-Delete:** Ability for an admin to deactivate or archive departed members without corrupting historical quiz records.
8. **Member Contact Details & Editing:** Ability to add email addresses, phone numbers, and edit member names post-creation.
9. **Admin Role Management (Promote / Demote):** Interactive buttons in `/admin/members` to promote members to `ADMIN` or demote an Admin back to `USER` (with self-demotion protection).
10. **Hard Delete with Confirmation:** A permanent deletion action for quizzes created entirely by mistake (as opposed to cancelling/archiving).

### D. Post-Quiz Evaluation & Historical Insights
11. **Lightweight Quiz Rating (1 to 5 Stars/Smileys) & Historical Match on Entry:**
    * **Simplicity & Zero Overhead:**
      * Once a quiz has ended (date and start time passed), participating team members can quickly rate the quiz on a **1 to 5 scale (stars or smileys)**: how enjoyable was the event?
      * No cumbersome questionnaires or forms: a single tap records the team's impression.
    * **Smart Historical Suggestion When Entering a New Quiz:**
      * When an admin scans a flyer or types in a quiz title and location (e.g. *"Den Dries Kwies 4"*), the system automatically checks whether the team has participated in prior editions in past years.
      * **Immediate Context on the Entry Screen:**
        * *"💡 You previously participated in this quiz! Previous rating: ⭐⭐⭐⭐☆ (4/5)"*
      * Provides immediate decision support when deciding whether to add and register for a recurring annual pub quiz.
