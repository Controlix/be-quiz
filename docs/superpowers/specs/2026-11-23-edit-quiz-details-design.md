# Design Document: Edit Quiz Details (Collaborative Error Correction)

- **Date:** 2026-11-23
- **Status:** In Review (Pending Builder Check & User Approval)
- **Author:** Team & AI Agent
- **Supersedes:** [2026-11-22-edit-quiz-details-draft-spec.md](./2026-11-22-edit-quiz-details-draft-spec.md)
- **Related ADR:** [ADR 0008: Role-Based Authorization over Granular Permissions](../../adr/0008-role-based-authorization-over-granular-permissions.md)
- **Roadmap Item:** [#1 Edit Quiz Details (Collaborative Error Correction)](../../roadmap.md#1-edit-quiz-details-error-correction)

---

## 1. Intent & Problem Statement

In **be-quiz**, quiz events are created manually or via AI Vision flyer scanning. In practice, typos, OCR misreads (wrong venue, date, time, or entry fee), and organizer schedule updates happen frequently. Currently, event metadata is immutable in the UI once created; the existing `/quizzes/[id]/edit` route is restricted to `ADMIN` and only manages team capacity, registration reset, and quiz cancellation.

This design enables **collaborative, manual error correction** for any authenticated teammate (`USER` or `ADMIN`) directly from the quiz detail view via an edit modal, while keeping team governance actions strictly `ADMIN`-only and preserving existing start-time lockdowns.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **In-App Error Correction:** Let any logged-in teammate edit core quiz metadata (`title`, `date`, `time`, `location`, `organizerEmail`, `entryFee`) directly from `/quizzes/[id]`.
- **Fast Mobile Modal (`EditQuizDialog`):** Triggered via a `[✏️ Bewerken]` button on `/quizzes/[id]` so users fix typos in place without navigating away from the quiz detail view.
- **100% Shared Form & Validation Logic:** Extract reusable form fields (`QuizMetadataFields`) and entry-fee parsing (`parseStructuredEntryFee`) so quiz creation (`QuizEntryForm`) and editing (`EditQuizDialog`) share identical inputs, formatting, and validation rules.
- **Start-Time Lockdown Consistency:** Enforce the existing `isQuizLockedForUser(quiz, role)` rule on both UI and Server Action (`USER` blocked after `startsAt` or when `CANCELLED`/`ARCHIVED`; `ADMIN` retains post-start edit access).
- **Governance Separation:** Keep `/quizzes/[id]/edit` (`EditQuizClient`) strictly `ADMIN`-only for `maxTeamSize`, registration reset, and quiz cancellation.
- **Domain Event Propagation:** Reuse `updateQuizDetails()` in `src/services/quizService.ts` so `quiz.details_updated` automatically synchronizes external subscribers (e.g., Shared Google Calendar).
- **Roadmap Clarity:** Rename the roadmap item from `#1 Admin Edit Quiz Details` to `#1 Edit Quiz Details (Collaborative)` so it accurately reflects member-wide access.

### Non-Goals

- **Database Schema Changes:** Prisma's `Quiz` model already has all required columns.
- **Flyer Replacement / AI Re-Scan:** Uploading or replacing a flyer image during edit is explicitly deferred; existing `flyerImageUrl` values remain untouched.
- **Hidden Schema Fields (`registrationUrl`, `notes`):** Neither field is currently shown or edited in the UI and both remain out of scope for this iteration.
- **Field-Level Revision History:** No audit log or diff tracking in v1.
- **Granular Permissions:** Retain coarse `USER` / `ADMIN` roles per ADR 0008.

### Anti-Goals

- **No In-Place Inline Inputs:** Do not clutter the mobile Quiz Detail reading view with permanently inline form controls.
- **No Duplicate Validation or Formatting:** Do not maintain parallel copies of European date/time formatting, email validation, or entry-fee formatting.
- **No Optimistic State Drift:** Do not mutate displayed quiz state before `updateQuizDetailsAction` returns `{ success: true }`.
- **No Governance Bypass:** `updateQuizDetailsAction` must never accept `maxTeamSize`, `status`, or `flyerImageUrl`.

---

## 3. Sizing & Approaches Considered

**Work Size:** Small-to-medium feature (~6 files touched across service helpers, shared form fields, Server Action, modal dialog, quiz detail client, plus unit/action tests and docs).

### Option A: Edit Modal (`EditQuizDialog`) on `/quizzes/[id]` _(Selected)_

- **How it works:** Extract shared inputs into `QuizMetadataFields.tsx`. Add a `[✏️ Bewerken]` trigger on `/quizzes/[id]` (visible when `!isLockedForUser`) that opens a scrollable `EditQuizDialog` modeled after `AddGuestDialog` / `EnrollMemberDialog`.
- **Trade-offs:** Zero navigation overhead on mobile, keeps `/quizzes/[id]/edit` cleanly isolated behind its `ADMIN` route guard, and matches existing dialog UX. Requires vertical scrolling inside `max-h-[90dvh]` on compact mobile screens.

### Option B: Shared `/quizzes/[id]/edit` Page Route _(Rejected)_

- **How it works:** Remove the `ADMIN`-only redirect in `src/app/quizzes/[id]/edit/page.tsx` and conditionally hide admin controls for `USER`.
- **Why rejected:** Mixes collaborative typo correction onto the `"Admin Beheer"` page, weakens the clean route-level `ADMIN` boundary, and adds unnecessary page navigation for quick mobile edits.

### Option C: Inline Editing Inside Detail Card _(Dropped)_

- **Why dropped:** Violates the clean mobile reading experience and introduces layout shift on small screens.

---

## 4. Technical Design

### 4.1 Shared Helpers (`src/services/quizService.ts` & `src/lib/formatters.ts`)

1. **Expose Existing Formatters & Update Service:**
   - Remove `/** @internal */` from `formatEuropeanDate` and `formatEuropeanTime` in `src/lib/formatters.ts` so client edit components consume them directly in production code.
   - Remove `/** @internal */` from `UpdateQuizDetailsInput` and `updateQuizDetails` in `src/services/quizService.ts`.
2. **Shared Entry Fee Parser (`parseStructuredEntryFee`):**
   - Add `parseStructuredEntryFee(entryFee?: string | null): { amount: string; unit: "TEAM" | "PERSON" }` to `src/services/quizService.ts`:
     - If `!entryFee` or no numeric match, return `{ amount: "", unit: "TEAM" }`.
     - Detect `unit = /persoon|pp|p\.p\./i.test(entryFee) ? "PERSON" : "TEAM"`.
     - Extract first numeric value (`/[0-9]+([.,][0-9]+)?/`).
   - Update `QuizEntryForm.tsx` to use `parseStructuredEntryFee` during Vision extraction instead of inline regex logic, establishing a single source of truth for entry fee parsing and formatting (`formatStructuredEntryFee`).

### 4.2 Shared Form Component (`src/components/QuizMetadataFields.tsx`)

- Extract the 6 metadata inputs from `QuizEntryForm.tsx` into `QuizMetadataFields`:
  - `title` (`maxLength={100}`, required)
  - `date` (`DD/MM/JJJJ`, `maxLength={10}`, `formatEuropeanDateString`, required)
  - `time` (`HH:MM`, `maxLength={5}`, `formatEuropeanTimeString`, required)
  - `location` (`maxLength={120}`, required)
  - `organizerEmail` (`type="email"`, optional)
  - `entryFeeAmount` + `entryFeeUnit` (`"TEAM"` | `"PERSON"` toggle with `aria-pressed` attributes for accessibility and deterministic testing, optional)
- Accept an optional `teamSizeControl?: React.ReactNode` slot so `QuizEntryForm.tsx` keeps its exact `Max Spelers` stepper layout next to `location` on desktop/mobile without duplicating `location` markup.
- Support `disabled` (for in-flight submission) and `missingFields` highlighting (red border/tint on missing required fields).

### 4.3 Server Action (`src/actions/quizActions.ts`)

Add `updateQuizDetailsAction(quizId: string, rawInput: UpdateQuizMetadataInput)`:

```ts
export interface UpdateQuizMetadataInput {
  title: string;
  startsAt: Date | string;
  location: string;
  organizerEmail: string | null;
  entryFee: string | null;
}
```

Execution & enforcement flow:

1. **Authentication:** `const currentMember = await getSessionMember();` — if `!currentMember`, return `{ success: false, error: "Niet ingelogd" }`.
2. **Existence Check:** `const existingQuiz = await getQuizById(quizId);` — if `!existingQuiz`, return `{ success: false, error: "Quiz niet gevonden" }`.
3. **Lockdown Check:** `if (isQuizLockedForUser(existingQuiz, currentMember.role))` return `{ success: false, error: QUIZ_LOCKED_MUTATION_ERROR }`.
4. **Normalization & Validation:**
   - `title = (rawInput.title ?? "").trim()`, `location = (rawInput.location ?? "").trim()`. If either is empty, return `{ success: false, error: "Titel en locatie zijn verplicht." }`.
   - If `!rawInput.startsAt`, return `{ success: false, error: "Ongeldige startdatum of -tijd." }`. `startsAt = new Date(rawInput.startsAt)`. If `Number.isNaN(startsAt.getTime())`, return `{ success: false, error: "Ongeldige startdatum of -tijd." }`.
   - `organizerEmail = rawInput.organizerEmail?.trim() ? rawInput.organizerEmail.trim() : null`.
   - `entryFee = rawInput.entryFee?.trim() ? rawInput.entryFee.trim() : null`.
   - Run `validateQuizFields({ title, location, organizerEmail, entryFee })`; if `!validation.isValid`, return `{ success: false, error: Object.values(validation.errors)[0] }`.
5. **Persistence & Domain Event:** Call `updateQuizDetails(quizId, { title, startsAt, location, organizerEmail, entryFee })`. Explicitly omit `maxTeamSize`, `status`, `flyerImageUrl`, `registrationUrl`, and `notes`.
6. **Non-Fatal Cache Revalidation:** Wrap `revalidatePath("/quizzes")` and `revalidatePath(\`/quizzes/${quizId}\`)`inside a dedicated inner`try { ... } catch {}` block so Node/Vitest runs without a Next.js request context never fail falsely.
7. **Return Payload:** `{ success: true, quiz: { id, title, startsAt, location, organizerEmail, entryFee } }`.

### 4.4 Edit Modal (`src/components/EditQuizDialog.tsx`)

- **Trigger & Layout:** Centered overlay (`fixed inset-0 z-50`) with `max-h-[90dvh] overflow-y-auto` for mobile portrait/landscape usability, matching `AddGuestDialog` styling.
- **Wrapper-Remount State Lifecycle:**
  - Export `EditQuizDialog(props: EditQuizDialogProps)` as a thin guard: `if (!props.isOpen) return null; return <EditQuizDialogContent {...props} />;`.
  - Inside `EditQuizDialogContent`, initialize `useState` directly from `props.quiz` (`formatEuropeanDate(quiz.startsAt)`, `formatEuropeanTime(quiz.startsAt)`, `parseStructuredEntryFee(quiz.entryFee)`, etc.).
  - This guarantees both instant pre-population under `renderToStaticMarkup` (without `useEffect`) and automatic cleanup of dirty edits, `missingFields`, and `errorBanner` on every close/reopen cycle.
- **Submission Contract (`onSave`):**
  - Follows the exact `AddGuestDialog.onAddGuest` / `EnrollMemberDialog.onEnroll` convention: `onSave: (payload: UpdateQuizMetadataInput) => Promise<void>` where failure throws `new Error(res.error || ...)`.
  - Tracks `isSubmitting` (via prop from parent or local state) with `try { ... } finally { setIsSubmitting(false); }`, disabling close (`X`), `Annuleren`, and `Opslaan` buttons while in-flight.
  - Validates required fields, email format, and `parseEuropeanDateTime(date, time)` client-side before invoking `onSave`.
  - Converts empty `organizerEmail` or empty `entryFeeAmount` to `null` (not `undefined`) so clearing an optional field persists in the database.
  - Awaits `onSave(...)` before calling `onClose()`; if `onSave` throws, keeps the dialog open and displays the error message in `errorBanner`.

### 4.5 Quiz Detail Client (`src/components/QuizDetailClient.tsx`)

- **Single Source of Truth:** Maintain a single `quizDetails` state object (`{ id, title, startsAt, location, organizerEmail: quiz.organizerEmail ?? null, entryFee: quiz.entryFee ?? null, flyerImageUrl: quiz.flyerImageUrl ?? null, status: quiz.status ?? "OPEN", durationMinutes: quiz.durationMinutes ?? 180 }`) initialized from `quiz`. Derive `dateStr`, `isConcluded` (passing `new Date(quizDetails.startsAt)`), `isPersonalLocked`, `isLockedForUser`, header/flyer title, Meta Details Card rows, and `ActionToolbar` props (`quizTitle`, `quizDate`, `location`, `organizerEmail`) purely from `quizDetails`.
- **Trigger Placement:** Render a compact `[✏️ Bewerken]` button (with `Pencil` icon) inside the Meta Details Card header (or top action bar beside Admin) whenever `!isLockedForUser`.
- **Save Handler:** Calls `updateQuizDetailsAction(quizDetails.id, payload)`. If `!res.success` (or no `res.quiz`), throws `new Error(res.error || "Fout bij bijwerken van quizgegevens")` so `EditQuizDialog` stays open and renders the error. Only upon `{ success: true, quiz }` does it merge `{ ...prev, ...res.quiz }` into `quizDetails` (no `useRouter().refresh()`, matching all other mutations in `QuizDetailClient` so existing `renderToStaticMarkup` tests remain unaffected while `revalidatePath` keeps RSC routes fresh).

---

## 5. Error Handling & Edge Cases

- **Clearing Optional Fields:** Clearing `organizerEmail` or `entryFeeAmount` passes `null` to `updateQuizDetailsAction`, ensuring Prisma clears the database field rather than skipping it.
- **Invalid Date/Time Input:** Partial or impossible dates (e.g., `31/02/2026` or `25:99`) are caught by `parseEuropeanDateTime` on the client and `Date` validity check on the server, displaying an inline Dutch validation message without closing the dialog.
- **Post-Start Race Condition:** If a quiz starts while a `USER` already has the dialog open and then taps `Opslaan`, `updateQuizDetailsAction` rejects the mutation with `QUIZ_LOCKED_MUTATION_ERROR`, keeping the error visible in the dialog.
- **Unauthenticated / Expired Session:** Returns `"Niet ingelogd"` without modifying database state.
- **Admin Governance Integrity:** Team capacity, registration reset, and cancellation remain exclusively in `src/app/quizzes/[id]/edit/page.tsx` and `src/actions/adminActions.ts`.

---

## 6. Review Focus & Testing Strategy

Every test targets real observable behavior, domain invariants, or security boundaries in Vitest (`environment: "node"`):

1. **Pure Helper Unit Tests (`tests/ui/entryFee.test.ts`, `tests/lib/formatters.test.ts`):**
   - `parseStructuredEntryFee` handles `"€20 / ploeg"`, `"€5 / persoon"`, `"15 pp"`, `null`, and empty strings; round-trips cleanly with `formatStructuredEntryFee`.
   - `formatEuropeanDate` + `formatEuropeanTime` + `parseEuropeanDateTime` round-trip accurately using local Date constructors (e.g. `new Date(2026, 10, 20, 20, 0)`) so assertions remain timezone-agnostic.
2. **Server Action Integration Tests (`tests/actions/editQuizDetailsAction.test.ts`):**
   - Rejects unauthenticated callers (`"Niet ingelogd"`).
   - Rejects unknown `quizId` (`"Quiz niet gevonden"`).
   - Enforces `isQuizLockedForUser`: blocks `USER` on started, `CANCELLED`, and `ARCHIVED` quizzes with `QUIZ_LOCKED_MUTATION_ERROR`; allows `ADMIN` on started/cancelled/archived quizzes.
   - Allows `USER` on open future quizzes, updates all 5 metadata fields, clears `organizerEmail`/`entryFee` when passed `null`, leaves `maxTeamSize`, `flyerImageUrl`, and `status` untouched, and emits `quiz.details_updated`.
   - Rejects invalid inputs (blank title/location, invalid/null date, invalid email, exceeding field max lengths).
3. **UI Component Tests (`tests/components/EditQuizDialog.test.tsx`, `tests/components/QuizDetailEditTrigger.test.tsx`):**
   - `EditQuizDialog` renders pre-populated metadata (`DD/MM/YYYY`, `HH:MM`, parsed fee amount, and `aria-pressed` unit toggle state) when `isOpen={true}`, and renders empty string when `isOpen={false}`.
   - `QuizDetailClient` renders the `Bewerken` button for unlocked `USER` and `ADMIN`, hides it for locked `USER` (`startsAt <= now`, `CANCELLED`, `ARCHIVED`), and keeps it visible for `ADMIN` on locked quizzes.
4. **Full Verification Gate:**
   - `npm run check:all` (`typecheck`, `test`, `lint`, `format:check`, `audit:check`, `scan:secrets`, `knip`, `knip:prod`).

---

## 7. Documentation Updates (Upon Implementation)

- `docs/roadmap.md`: Rename `#1 Admin Edit Quiz Details` to `#1 Edit Quiz Details (Collaborative)` and link to this spec/plan.
- `docs/architecture/roles-and-permissions.md`: Add `Edit quiz metadata` (`updateQuizDetailsAction`) to the permission matrix (`USER` pre-start, `ADMIN` always).
- `docs/architecture/overview.md`: Add `EditQuizDialog` to the client component diagram/list if applicable.
