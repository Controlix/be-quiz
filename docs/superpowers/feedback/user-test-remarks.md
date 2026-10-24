# Pub Quiz App (BE-Quiz) — Feedback & Feature Roadmap

This document serves as the single source of truth for:
1. **v1 Priority Fixes & Polish** (Items from user testing ready to implement now)
2. **v2 Feature Backlog** (Items postponed during original requirements capture + today's user testing)

---

## Part 1: v1 Priority Fixes & Improvements

### 1. Date & Time Formatting (European Format)
* **Feedback:** Date and time are currently shown in US format.
* **Requirement:** Standardize all dates and times across the app to European format:
  * Date: `DD/MM/YYYY` (e.g. `14/11/2026`)
  * Time: `HH24:MI` (24-hour time, e.g. `20:00`)
* **Scope:** Quiz cards, quiz detail view, new quiz form inputs, registration email copy, calendar exports, and WhatsApp messages.
* **Status:** Completed

### 2. Registration Email Double-Encoding / Escape Characters (Bug)
* **Feedback:** The email text is not clean; it contains lots of escape characters (e.g. `%0D%0A`, `%20`).
* **Root Cause:** Double URL-encoding in the mailto generator (`encodeURIComponent` was called on strings already containing literal `%0D%0A`).
* **Requirement:** Clean up the email text formatting so that opening in the mail client or clicking "Kopieer mailtekst" produces clean plain text with real line breaks and proper characters.
* **Status:** Completed

### 3. Visible Logout Button in UI
* **Feedback:** No logout button visible in the app.
* **Requirement:** Add a clear "Afmelden" (Logout) button/icon in the dashboard header so users can easily sign out.
* **Status:** Completed

### 4. Mobile-Friendly Stepper for Max Team Size (UX)
* **Feedback:** The native numeric input up/down spinner control is not user-friendly on mobile screens.
* **Requirement:** Replace `<input type="number">` with a mobile-optimized stepper control featuring large, thumb-friendly `[-]` and `[+]` buttons (with bounds 1–10, default 4).
* **Scope:** New quiz entry form (`QuizEntryForm.tsx`) and admin edit page (`EditQuizClient.tsx`).
* **Status:** Completed

### 5. Drag-and-Drop & Clipboard Paste for Flyer Upload (Bug / Enhancement)
* **Feedback:** Dragging and dropping an image or screenshot into the flyer upload box does not work.
* **Requirement:** Add full drag-and-drop dropzone support, visual highlight on drag hover, and allow pasting screenshots directly (`Ctrl+V` / `Cmd+V`).
* **Status:** Completed

### 6. Currency Symbol: Replace Dollar Sign ($) with Euro (€)
* **Feedback:** The "Inschrijfgeld" button displays a dollar sign `$` icon.
* **Requirement:** Replace the Lucide `DollarSign` icon with an `Euro` icon/glyph (`€`) on the action buttons and payment badges.
* **Status:** Completed

### 7. Field Length Limits & Validation (Input Validation)
* **Feedback:** No character length limit on Title and Location fields.
* **Requirement:** Enforce reasonable maximum lengths on both client forms and server actions:
  * Title: max 100 characters (`maxLength={100}`)
  * Location: max 120 characters (`maxLength={120}`)
  * Entry fee: max 40 characters (`maxLength={40}`)
* **Status:** Completed

### 8. Email Format Validation (Input Validation)
* **Feedback:** No validation on the organizer email field; any string can be submitted.
* **Requirement:** If an organizer email is entered, validate that it matches a valid email address format (e.g. `naam@domein.be`) on both the client form and server action, showing a clear error if invalid.
* **Status:** Completed

### 9. Structured Entry Fee: Amount & Unit (per ploeg / per persoon)
* **Feedback:** Entry fee should not be free text; it should be a structured amount per team or per person (defaulting to per team).
* **Requirement:** Replace free-text entry fee with:
  * Amount input: numeric field with `€` prefix (e.g. `20` or `25`)
  * Unit selector: toggle buttons between **"per ploeg"** (default) and **"per persoon"**
  * Auto-format cleanly as `€20 / ploeg` or `€5 / persoon` on cards and detail views.
* **Status:** Completed

### 10. Admin Team Size Bounds & Validation (Input Validation)
* **Feedback:** No validation or bounds enforcement on team size in the admin edit screen; arbitrary numbers can be saved.
* **Requirement:** Enforce strict team size bounds (min 1, max 10) on both the admin edit UI (via stepper) and in the backend server action `adminUpdateTeamCapacityAction`.
* **Status:** Completed

### 11. Team Name: "Ben in Black"
* **Feedback:** The team name is "Ben in Black" (was defaulted to "De Quizvrienden").
* **Requirement:** Ensure seeds and schema defaults permanently reflect **"Ben in Black"**.
* **Status:** Completed

### 12. Admin Participant & Reserve Reordering (Touch Drag-and-Drop)
* **Feedback:** Up/down buttons waste precious vertical screen space on mobile.
* **Requirement:** Use a slim, space-saving drag handle (`⠿` GripVertical) for admins to drag and drop players into any position, keeping the mobile rows compact and clean without bulky button clusters.
* **Status:** Completed

### 13. Name + 4-Digit Personal PIN Authentication
* **Feedback:** Token links in WhatsApp are awkward for switching devices, long-term use, and logout.
* **Requirement:** Name picker + 4-digit personal PIN on login; first-time PIN selection; rolling 90-day sessions; admin PIN reset in `/admin/members`; architecture decoupled for future auth methods.
* **Status:** Completed

### 14. Clean Initial Production State (Zero Sample Data)
* **Feedback:** When going live, the app must start completely clean: zero sample quizzes and only Marc as Admin.
* **Requirement:** Configure the production seed and clean state so that:
  * Exactly 0 quizzes exist initially.
  * Exactly 1 member exists initially: Marc (`ADMIN`).
  * Dashboard renders a clean empty state: *"Nog geen quizzen gepland. Tik op '+ Nieuwe Quiz' om de eerste toe te voegen!"*
  * All friends are invited afresh via their invite links.
* **Status:** Completed

---

## Part 2: Consolidated v2 Feature Backlog

### A. Teams & Capacity (from initial requirements review)
1. **Multiple Teams per Quiz (e.g. Team A / Team B):** When more friends want to join than the maximum team limit (e.g. 8 people for a 4-person quiz), allow fielding a second team instead of putting everyone on reserve. *(The schema already decouples `Team` from `Quiz` to make this seamless).*
2. **Guest Players:** Ability to add an external guest or partner to the lineup who is not an official registered app member.

### B. Logistics & Coordination (from initial requirements review)
3. **Carpooling & Ride-Sharing:** Allow members to indicate if they can drive (with seat counts) and assign passengers to cars, replacing ride discussions in WhatsApp.
4. **Public / Unauthenticated Share Preview:** A minimal read-only preview link for WhatsApp so non-members can view public event details (date, venue, spots left) without seeing personal friend rosters or requiring a login.

### C. Member Management & Administration (from initial requirements review)
5. **Member Deactivation / Soft-Delete:** Ability for an admin to deactivate or archive departed members without corrupting historical quiz records.
6. **Member Contact Details & Editing:** Ability to add email addresses, phone numbers, and edit member names post-creation.
7. **Admin Role Management (Promote / Demote):** Interactive buttons in `/admin/members` to promote members to `ADMIN` or demote an Admin back to `USER` (with self-demotion protection).
8. **Hard Delete with Confirmation:** A permanent deletion action for quizzes created entirely by mistake (as opposed to cancelling/archiving).

### D. User Experience & Enhancements (from user testing)
9. **Flyer Image Display on Quiz Detail View:** Displaying the actual uploaded flyer poster as a rich banner on the quiz details screen, with a tap-to-expand fullscreen modal.
10. **Maps Integration (Navigation):** Tapping the venue/address on cards or detail views opens Google Maps / Apple Maps / Waze with direct route navigation.
11. **Duplicate Quiz Detection on Entry:** Warn the user when adding a quiz if another quiz already exists on the same date or at the same venue to prevent accidental duplicates.
12. **Direct Registration Toggle (Without Email):** Ability to directly mark a quiz team as registered (e.g. via a *"Markeer als ingeschreven"* button) for instances where registration was handled in person, via telephone, WhatsApp, or Facebook Messenger, without triggering the `mailto:` email hand-off.
