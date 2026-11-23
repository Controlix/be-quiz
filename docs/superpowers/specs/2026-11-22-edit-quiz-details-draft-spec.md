# Design Document: Edit Quiz Details (Collaborative Error Correction)

> **Superseded:** Replaced by [2026-11-23-edit-quiz-details-design.md](./2026-11-23-edit-quiz-details-design.md) (Option A modal, manual edits only, current UI fields only).

- **Date:** 2026-11-22
- **Status:** Superseded
- **Author:** Team & AI Agent
- **Target App Version:** `v2.7.0`
- **Related ADR:** [ADR 0008: Role-Based Authorization over Granular Permissions](../../adr/0008-role-based-authorization-over-granular-permissions.md)
- **Roadmap Item:** [#1 Admin Edit Quiz Details / Collaborative Error Correction](../../roadmap.md#1-admin-edit-quiz-details-error-correction)

---

## 1. Intent & Problem Statement

In **be-quiz**, quiz events are created either manually or via AI Vision scanning of event flyers. In real-world use, errors or changes frequently arise:

1. **AI OCR Misreads:** The vision scanner may misread an obscure font, date, time, or location on the flyer.
2. **User Typos:** Organizers or members mistype venue addresses, entry fees, or titles.
3. **Organizers Change Schedules:** Quiz organizers may push back start times, change rooms, or adjust entry fees after initial publication.

Currently, once a quiz is created, its core event details are completely immutable in the UI. Correcting any typo or change requires manual database surgery (direct SQL queries). While an admin edit page exists (`/quizzes/[id]/edit`), it is restricted to `ADMIN` only and exposes only capacity adjustment, registration reset, and quiz cancellation.

### The Collaborative Direction ("Wiki-Style" Team Editing)

In a trusted team setting (a group of friends coordinating quiz nights), any member can create a quiz. Restricting simple typo fixes to administrators creates unnecessary bottlenecks.

This design establishes a collaborative model for v1:

- **Collaborative Content Editing (All Members):** Any logged-in member (`USER` or `ADMIN`) can edit event metadata (title, date, time, location, entry fee, organizer links, notes, and flyer) via a dedicated pencil button `[✏️ Bewerken]` on the quiz detail page.
- **Administrative Governance (`ADMIN` Only):** Destructive or structural actions (changing team capacity, resetting official registration, cancelling/archiving the quiz) remain strictly reserved for administrators.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **In-App Error Correction:** Allow team members to correct any quiz details directly in the application without database intervention.
- **Pencil Icon Trigger:** Add an intuitive pencil button (`[✏️ Bewerken]`) directly accessible from the Quiz Detail view (`/quizzes/[id]`).
- **Code & Form Reuse:** Maximize reuse of the existing form fields, validation rules, European date/time parsing, and fee formatting from `QuizEntryForm.tsx`.
- **Domain Event Propagation:** When details are updated, emit `quiz.details_updated` via `src/services/quizService.ts` to automatically synchronize external integrations (such as the shared Google Calendar).
- **Separation of Concerns:** Keep dangerous team-structure mutations (capacity, cancellation, registration reset) separated from event metadata editing.

### Non-Goals

- **Database Schema Migrations:** No schema changes are needed; Prisma's `Quiz` model and `updateQuizDetails` service method already support all target fields.
- **Revision History / Audit Logs:** We do not track fine-grained field-by-field edit history or diffs in v1.
- **Multi-Tenant Permission Rules:** Coarse roles (`USER` vs `ADMIN`) remain the single authorization mechanism per ADR 0008.

### Anti-Goals

- **No In-Place Form Clutter:** Do not compromise the clean, thumb-friendly mobile reading experience of the Quiz Detail card with permanent input fields.
- **No Duplicate Validation Logic:** Do not write separate, parallel validation routines for editing versus creating quizzes.

---

## 3. UI & Ergonomics Options (Brainstorming Findings)

Two primary delivery mechanisms were evaluated for the edit experience:

### Option A: Slide-up Bottom Sheet / Modal (`EditQuizDialog`) — Preferred for Mobile

- **Interaction:** Tapping `[✏️ Bewerken]` on `/quizzes/[id]` opens a smooth slide-up modal / sheet overlay containing pre-populated form fields.
- **Advantages:**
  - Standard mobile design pattern.
  - Keeps the user on the quiz detail page; saving closes the sheet and updates the view in place without full navigation.
  - Eliminates accidental taps or layout shifts while scrolling rosters or RSVPs.
  - Clear **Annuleren** (Cancel) and **Opslaan** (Save) action buttons pinned in view.

### Option B: Dedicated Edit Page (`/quizzes/[id]/edit`)

- **Interaction:** Tapping `[✏️ Bewerken]` navigates directly to `/quizzes/[id]/edit`.
- **Modifications Needed:**
  - Remove the admin-only route guard from `/quizzes/[id]/edit` to allow any authenticated `USER`.
  - Conditionally render admin sections (Team Capacity, Cancel Quiz, Reset Registration) only if `currentMember.role === "ADMIN"`.
  - Embed the shared quiz form in `mode="edit"`.
- **Advantages:**
  - Full-screen real estate; natural on desktop.
  - Leverages existing Next.js page routing.

---

## 4. Component Reuse Strategy

`QuizEntryForm.tsx` currently contains battle-tested logic that must be reused rather than duplicated:

1. **Date & Time Formatting:**
   - `parseEuropeanDateTime` for parsing `DD/MM/YYYY` and 24-hour `HH:MM` strings into UTC timestamps.
   - `formatEuropeanDateString` and `formatEuropeanTimeString` for pre-populating inputs.
2. **Entry Fee Structured Formatting:**
   - `formatStructuredEntryFee(amount, unit)` with `"TEAM"` vs `"PERSON"` toggle.
3. **Organizer Validation:**
   - Email regex validation and missing-field detection.
4. **Flyer Management:**
   - Displaying the active flyer preview with the ability to replace it via `FlyerUploader`.

### Proposed Component Decomposition:

Extract a shared form component or container (`QuizFormFields.tsx` or parameterized `QuizEntryForm.tsx` supporting `initialValues` and `onSubmit` / `mode="edit"`) so both `/quizzes/new` and the edit flow share 100% of the field components and validation.

---

## 5. Flyer Replacement & Smart Non-Destructive Re-Scanning

When editing an existing quiz, replacing the flyer image introduces distinct operational challenges:

1. **Risk of Data Loss:** If a newly scanned flyer is incomplete (e.g. it omits the venue address or entry fee that was previously entered), a naive scan would overwrite established data with empty values.
2. **Unnoticed Overwrites:** If OCR slightly re-interprets a title or time, the user might save without realizing an existing field was altered.

To solve this, the edit workflow establishes two upload intents and a non-destructive merge algorithm with visual diff cues.

### 5.1 User Upload Intent: Image Only vs Image + Re-Scan

When uploading a replacement flyer on an existing quiz, the UI presents two distinct actions:

1. **Enkel afbeelding vervangen (Image Only):** Updates `flyerImageUrl` only. Leaves all existing text, dates, times, and fees 100% untouched. (Ideal when swapping a low-resolution flyer for a high-resolution poster).
2. **Afbeelding vervangen én opnieuw scannen (Image + AI Re-Scan):** Uploads the image and re-runs AI Vision extraction, applying the merge algorithm below.

### 5.2 Non-Destructive Merge Algorithm (Zero Data Loss)

When re-scanning a replacement flyer:

- **Field Positively Extracted:** If the AI extracts a non-empty value (e.g. new start time `19:30`), the field value updates to the new candidate.
- **Field Missing / Unrecognized:** If the AI does not recognize a field (e.g. location is missing or in `missingFields`), **the existing value is strictly retained**. The system NEVER wipes out an existing value with `null` or empty string.

```ts
// Conceptual Merge Logic:
const mergedForm = {
  title: extracted.title?.trim() || existingQuiz.title,
  date: extracted.date ? formatEuropeanDateString(extracted.date) : existingDate,
  time: extracted.time ? formatEuropeanTimeString(extracted.time) : existingTime,
  location: extracted.location?.trim() || existingQuiz.location,
  entryFee: extracted.entryFee || existingQuiz.entryFee,
  organizerEmail: extracted.organizerEmail || existingQuiz.organizerEmail,
  registrationUrl: extracted.registrationUrl || existingQuiz.registrationUrl,
};
```

### 5.3 Visual Diff & Change Highlights

Before saving, the form visually communicates which fields were altered by the scan versus retained:

- **Changed Fields:** Highlighted with an accent border and a diff note:  
  `✨ Gewijzigd door scan (was: "<oude waarde>")` alongside a quick 1-tap revert button (`↩️ Herstel`) to restore the original value.
- **Retained Fields:** Subtle badge below the input:  
  `🛡️ Behouden (niet gevonden op nieuwe flyer)`.
- **Unchanged Fields:** Standard styling without extra visual noise.

This ensures complete transparency: the user clearly sees what changed, can undo specific fields with one tap, and confirms everything before tapping **Opslaan**.

---

## 6. Security & Domain Invariants

1. **Authentication Requirement:**
   - Any edit mutation must require an active session (`getSessionMember()`). Anonymous visitors cannot edit quiz details.
2. **Start-Time Freeze Decision (Open Topic):**
   - _Consideration:_ Under the Quiz Start Lockdown rule, rosters freeze when `startsAt <= now`.
   - _Recommended Rule:_ For regular members (`USER`), editing event metadata also freezes at `startsAt <= now` (preventing retroactive alteration of past events). Administrators (`ADMIN`) retain the ability to edit historical quiz details to correct records post-event.
3. **Team Capacity Invariant:**
   - Adjusting maximum team capacity (`maxTeamSize`) alters active lineup vs reserve waitlist assignments. It must **not** be editable in the collaborative metadata form; it remains an explicit administrative action in `adminUpdateTeamCapacityAction`.

---

## 7. Open Decision Points for Next Phase

Before transitioning from this draft spec into an implementation plan, the following choices should be finalized:

1. **Modal / Sheet (Option A) vs Full Page Route (Option B):** Confirm whether the slide-up modal or the dedicated page route is preferred.
2. **Post-Start Edit Lockdown:** Confirm whether non-admin editing freezes once `startsAt <= now`.
