# Design Document: Pub Quiz App (BE-Quiz) — v1 Must-Haves
**Date:** 2026-10-25  
**Topic:** Implementation of Items 15 (Decoupled Registration Confirmation) and 16 (In-App Feedback Widget with Viewport Capture & Admin Back-Office)

---

## 1. Intent & The Why

During user testing of KwisVrienden, two remaining high-priority v1 requirements were identified:
1. **Item 15 (Registration Confirmation Timing):** When registering a team via email, the app previously triggered a synchronous `window.confirm` popup before opening the email client. This interrupted the browser's ability to launch the user's mail app cleanly and forced the user to confirm sending an email before they could even inspect or send it.
2. **Item 16 (In-App Feedback & Bug Reporting):** As friends test the app on varied mobile devices (iOS Safari, Android Chrome, PWAs), there must be a frictionless, 1-tap mechanism to report glitches, share suggestions, or ask questions with automatic viewport screenshot capture and device diagnostics, stored directly in the app's database and manageable via a desktop admin back-office.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Clean Registration Mail Flow:** Clicking "Open Mail" immediately launches the user's mail client with the prefilled draft. An explicit, decoupled button allows users to mark the team as registered whenever they are ready.
- **Low-Friction Feedback Submission:** A floating action button (FAB) available on all core pages triggers a modal where users can pick a category, type notes, and submit.
- **Automated Viewport Capture:** Using `html2canvas`, the user's current viewport is automatically captured when the feedback modal is opened, with preview thumbnail, remove option, and file upload fallback.
- **Rich Context Capture:** Automatically attach current URL path, device user-agent, and authenticated member information.
- **Central Admin Hub (`/admin`):** A unified back-office homescreen for admins that links to all administrative functions (Feedback & Bug Review, Member & PIN Management, and Team Settings), with a direct header link from the dashboard for admins.
- **Self-Contained Storage & Back-Office:** Store submissions in Postgres via a new Prisma `Feedback` model and save screenshot images to `public/uploads/feedback/`. Provide a dedicated `/admin/feedback` desktop view for filtering, reviewing, zooming screenshots, and marking items as resolved.

### Non-Goals
- No third-party SaaS feedback tools (e.g., Sentry User Feedback, Userback, Formbricks, LogRocket); all data and screenshots remain private and self-hosted in KwisVrienden.
- No real-time chat or two-way messaging within the feedback tool; this is a one-way bug and suggestions reporting funnel.

### Anti-Goals
- Do not block or slow down mobile navigation with heavy scripts; `html2canvas` should only be loaded dynamically when feedback is opened.
- Do not lose draft text or trap the user if viewport canvas generation fails on obscure browsers (always allow text submission and optional manual image attachment).

---

## 3. Constraints
- **Framework & Libraries:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma ORM with PostgreSQL.
- **Mobile First for Players, Desktop for Admin:** The feedback widget must be thumb-friendly and non-intrusive on mobile phones; the `/admin/feedback` interface is optimized for desktop review with expandable tables and modal lightbox for screenshots.
- **Authentication & Roles:** Submitting feedback inherits the active session member. Accessing `/admin/feedback` is strictly restricted to members with role `ADMIN`.

---

## 4. Approaches Considered & Trade-offs

### Registration Confirmation Flow (Item 15)
- **Approach 1 (Chosen): Explicit Decoupled Action:**
  - Clicking "Schrijf Ploeg In (Open Mail)" fires `mailto:` without popup interruptions.
  - An adjacent button ("Mail verstuurd? Bevestig registratie" when unconfirmed) lets the user confirm at their own pace.
  - When registered, it displays "✓ Ploeg is ingeschreven" with an option to reopen mail or undo registration.
  - *Trade-off:* Requires a distinct second tap to confirm, but eliminates all browser mail-launch blocking bugs and matches user mental model.
- **Approach 2: Focus-Detection Auto-Prompt:**
  - Fires `mailto:`, then checks `window.onfocus` to pop a confirmation dialog when returning to the tab.
  - *Why dropped:* Unreliable across mobile operating systems (iOS Safari often does not fire focus events reliably after app-switching).

### Feedback Trigger & Screenshot Capture (Item 16)
- **Trigger Location:**
  - **Option A (Chosen): Floating Action Button (FAB) Bottom-Right:** Discreet pill (`💬 Feedback`) fixed at bottom-right, always thumb-accessible.
  - **Option B: Header Navigation Icon:** Integrated into top bar next to logout. Dropped in favor of Option A based on user mockup review.
- **Screenshot Capture:**
  - **Approach A (Chosen): Dynamic `html2canvas` auto-capture + manual upload fallback:**
    - Fast, zero external SaaS cost, captures exact client DOM state into PNG/JPEG.
    - If canvas fails or user prefers, allows removing or attaching a photo manually.
  - **Approach B: Manual photo upload only (no canvas):**
    - Dropped because it requires users to manually press hardware buttons to screenshot, save to photos, and upload.

---

## 5. Detailed Architecture & Components

### 5.1 Database Schema (Prisma)
Add `FeedbackCategory` enum and `Feedback` model in `prisma/schema.prisma`:
```prisma
enum FeedbackCategory {
  BUG
  IDEA
  QUESTION
}

model Feedback {
  id         String           @id @default(cuid())
  category   FeedbackCategory @default(BUG)
  message    String
  pageUrl    String
  userAgent  String?
  screenshot String? // Relative URL e.g. /uploads/feedback/<uuid>.jpg
  memberId   String?
  member     Member?          @relation(fields: [memberId], references: [id], onDelete: SetNull)
  isResolved Boolean          @default(false)
  resolvedAt DateTime?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@index([createdAt])
  @@index([isResolved])
}
```

Add reverse relation `feedbacks Feedback[]` to `Member` model.

### 5.2 Server Actions & Storage
1. **Storage Helper (`src/lib/storage.ts`):**
   - Add `saveUploadedFeedbackImage(fileBuffer: Buffer, mimeType: string): Promise<string>` saving to `public/uploads/feedback/`.
2. **Feedback Server Actions (`src/actions/feedbackActions.ts`):**
   - `submitFeedbackAction(formData: FormData)`: validates message length (min 3 chars), category, extracts user session, stores screenshot if provided, creates DB record, revalidates `/admin/feedback`.
   - `toggleFeedbackResolvedAction(feedbackId: string)`: toggles `isResolved` and updates `resolvedAt` (Admin only).
   - `deleteFeedbackAction(feedbackId: string)`: deletes feedback entry and cleans up uploaded screenshot file (Admin only).

### 5.3 Registration Flow Updates (`src/components/ActionToolbar.tsx`)
- Remove synchronous `window.confirm` from `<a href={mailtoUrl}>`.
- When `!isRegistered`:
  - Primary button: "Schrijf Ploeg In (Open Mail)" -> triggers `mailtoUrl`.
  - Secondary confirmation button: "Mail verzonden? Bevestig registratie" -> calls `onRegisterToggle()`.
  - Copy mail button remains available.
- When `isRegistered`:
  - Show status badge "✓ Ingeschreven".
  - Button: "Open Registratie Mail Opnieuw" -> triggers `mailtoUrl`.
  - Secondary link: "Inschrijving annuleren / heropenen" -> resets registration.

### 5.4 Feedback Widget Component (`src/components/FeedbackWidget.tsx`)
- Placed globally in root layout or dashboard/quizzes layout.
- Renders floating pill button at bottom-right (`bottom-5 right-5` or above safe area).
- On click:
  - Dynamically imports `html2canvas` (`import("html2canvas")`).
  - Hides the feedback modal container during capture to avoid self-capture.
  - Takes screenshot of `document.body`, converts to Blob and data URL preview.
  - Opens modal dialog containing:
    - Category pills: `🐛 Bug / Probleem` (`BUG`), `💡 Idee` (`IDEA`), `💬 Vraag` (`QUESTION`).
    - Textarea with placeholder and autofocus.
    - Screenshot preview thumbnail with "✕ Verwijderen" and fallback "Foto toevoegen" file input.
    - Context pill displaying: current user name, browser/OS, current route path.
    - Cancel & Submit buttons.
- On submit: sends to `submitFeedbackAction`, shows success toast ("Bedankt voor je feedback! 🙌"), and closes.

### 5.5 Central Admin Hub (`src/app/admin/page.tsx`)
- Protected by `getSessionMember()`, ensuring `role === "ADMIN"`.
- Serves as the central navigation dashboard for admins, displaying high-level stats and cards linking to:
  1. **Feedback & Problemen (`/admin/feedback`):** with badge count of unresolved feedback.
  2. **Vrienden & PIN Beheer (`/admin/members`):** roster overview, invite links, PIN resets.
  3. **Teaminstellingen (`/admin/settings`):** default team name ("Ben in Black") and global preferences.
- Header link on the main dashboard (`/quizzes`): if the logged-in user is an `ADMIN`, render an admin button (e.g. Shield/Sliders icon "Beheer") in the top navigation bar linking directly to `/admin`.

### 5.6 Admin Back-Office Feedback View (`src/app/admin/feedback/page.tsx` & Client Component)
- Protected by `getSessionMember()`, ensuring `role === "ADMIN"`.
- Desktop-friendly dashboard layout:
  - Header with count of open vs resolved feedback, back link to `/admin`.
  - Filter tabs: "Alle", "Openstaand", "Opgelost", and category filters.
  - Items list/table displaying:
    - Date & time (European format `DD/MM/YYYY HH:mm`).
    - Category badge (Red for Bug, Amber for Idea, Blue for Question).
    - Submitter name.
    - Route URL & device details.
    - Message text.
    - Screenshot thumbnail with click-to-zoom modal lightbox.
    - Action buttons: "Markeer als opgelost / heropen" and "Verwijderen".

---

## 6. What's Left to the Builder
- Specific Tailwind styling tweaks to ensure safe-area insets on iOS Safari for the floating button.
- Clean responsive layout adjustments for `/admin/feedback` table on both tablet and wide screens.
- Handling of edge cases where `html2canvas` fails (e.g. cross-origin iframe or canvas security error) by cleanly skipping screenshot auto-attachment without breaking the feedback submission.
