# Pub Quiz App (BE-Quiz) — v1 Must-Haves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple registration mail execution from registration confirmation (Item 15) and deliver a self-contained in-app feedback widget with automatic viewport capture, Prisma storage, central Admin Hub, and back-office review dashboard (Item 16).

**Architecture:** Client-side registration decoupling in `ActionToolbar.tsx`; floating action button widget with dynamic `html2canvas` client capture posting to Next.js server actions; file uploads stored locally in `public/uploads/feedback/`; persistent storage in Postgres via Prisma `Feedback` model; central `/admin` dashboard and desktop `/admin/feedback` review view guarded by admin session.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, Prisma ORM, PostgreSQL, `html2canvas`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-v1-must-haves-design.md`

## Global Constraints

- Date formatting must strictly use European format: `DD/MM/YYYY` (date) and `HH:mm` (time).
- Currency must strictly display Euro symbol `€`.
- Language & UI copy must be in clear, natural Dutch.
- Admin routes (`/admin`, `/admin/*`) must strictly verify session `role === "ADMIN"` and redirect unauthorized users to `/quizzes`.
- All feedback images must be validated, limited to max 5MB, and stored in `public/uploads/feedback/`.

## Review Focus

1. **Popup blocking prevention:** Ensure clicking the mailto link launches the client mail protocol directly without synchronous `window.confirm` or alert blocking browser execution.
2. **Dynamic `html2canvas` safety:** If `html2canvas` encounters cross-origin iframe or browser permission quirks, the feedback modal must still open cleanly, allowing text entry and manual file attachment.
3. **Feedback input validation:** Empty or whitespace-only messages must be rejected both on the client and in the server action (min 3 characters).
4. **Admin security gate:** Direct access to `/admin` or `/admin/feedback` by a non-admin or unauthenticated visitor must immediately redirect to `/quizzes` or `/auth/login`.
5. **Image file cleanup:** Deleting a feedback entry from the admin back-office must also cleanly delete the associated image file from disk without throwing if missing.

---

### Task 1: Decouple Registration Confirmation in ActionToolbar

**Files:**
- Modify: `src/components/ActionToolbar.tsx:90-117`
- Test: `tests/ui/actionToolbarRegistration.test.tsx`

**Interfaces:**
- Consumes: `ActionToolbarProps` (`isRegistered`, `onRegisterToggle`, `mailtoUrl`)
- Produces: Decoupled mailto click (immediate browser trigger) and dedicated registration toggle button

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/actionToolbarRegistration.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ActionToolbar } from "@/components/ActionToolbar";

describe("ActionToolbar - Decoupled Registration", () => {
  it("triggers mailto link without window.confirm and provides explicit confirm button when open", () => {
    const onRegisterToggle = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm");

    render(
      <ActionToolbar
        quizTitle="Test Quiz"
        quizDate={new Date("2026-11-14T20:00:00Z")}
        teamName="Ben in Black"
        isRegistered={false}
        isPaid={false}
        onRegisterToggle={onRegisterToggle}
        onPaymentToggle={vi.fn()}
      />
    );

    const mailLink = screen.getByRole("link", { name: /Schrijf Ploeg In \(Open Mail\)/i });
    fireEvent.click(mailLink);

    // Must NOT call window.confirm synchronously
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onRegisterToggle).not.toHaveBeenCalled();

    // Explicit confirmation button must be visible
    const confirmButton = screen.getByRole("button", { name: /Mail verzonden\? Bevestig registratie/i });
    fireEvent.click(confirmButton);
    expect(onRegisterToggle).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it("shows registered badge and option to reopen mail or undo registration when registered", () => {
    const onRegisterToggle = vi.fn();

    render(
      <ActionToolbar
        quizTitle="Test Quiz"
        quizDate={new Date("2026-11-14T20:00:00Z")}
        teamName="Ben in Black"
        isRegistered={true}
        isPaid={false}
        onRegisterToggle={onRegisterToggle}
        onPaymentToggle={vi.fn()}
      />
    );

    expect(screen.getByText("✓ Ingeschreven")).toBeDefined();
    expect(screen.getByRole("link", { name: /Open Registratie Mail Opnieuw/i })).toBeDefined();

    const undoButton = screen.getByRole("button", { name: /Inschrijving heropenen \/ annuleren/i });
    fireEvent.click(undoButton);
    expect(onRegisterToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/actionToolbarRegistration.test.tsx`
Expected: FAIL with "Unable to find an element with the role 'button' and name `/Mail verzonden\? Bevestig registratie/i`"

- [ ] **Step 3: Update `src/components/ActionToolbar.tsx`**

Remove the `window.confirm` block in `<a href={mailtoUrl}>`. Add the explicit confirmation button `Mail verzonden? Bevestig registratie` when `!isRegistered`, and when `isRegistered` render the undo button `Inschrijving heropenen / annuleren`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/actionToolbarRegistration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionToolbar.tsx tests/ui/actionToolbarRegistration.test.tsx
git commit -m "fix(registration): decouple mailto trigger from registration confirmation"
```

---

### Task 2: Prisma Schema & Storage for Feedback

**Files:**
- Modify: `prisma/schema.prisma:25-45`
- Create: `src/lib/feedbackStorage.ts`
- Test: `tests/db/feedbackSchema.test.ts`

**Interfaces:**
- Consumes: Prisma database connection (`@/lib/db`)
- Produces: `FeedbackCategory` enum, `Feedback` model, `saveUploadedFeedbackImage(buffer: Buffer, mimeType: string): Promise<string>` and `deleteFeedbackImage(relativeUrl: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/db/feedbackSchema.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { saveUploadedFeedbackImage, deleteFeedbackImage } from "@/lib/feedbackStorage";
import fs from "fs/promises";
import path from "path";

describe("Feedback Schema & Storage", () => {
  it("creates a feedback record with category, url and message", async () => {
    const feedback = await prisma.feedback.create({
      data: {
        category: "BUG",
        message: "Test error remark",
        pageUrl: "/quizzes",
        userAgent: "Vitest Test Runner",
      },
    });

    expect(feedback.id).toBeDefined();
    expect(feedback.category).toBe("BUG");
    expect(feedback.isResolved).toBe(false);

    // Cleanup
    await prisma.feedback.delete({ where: { id: feedback.id } });
  });

  it("saves and deletes feedback image from public uploads directory", async () => {
    const dummyBuffer = Buffer.from("fake-image-bytes");
    const uploadedUrl = await saveUploadedFeedbackImage(dummyBuffer, "image/jpeg");
    expect(uploadedUrl).toMatch(/^\/uploads\/feedback\/[a-f0-9-]+\.jpg$/);

    const fullDiskPath = path.join(process.cwd(), "public", uploadedUrl);
    const fileExistsBefore = await fs.access(fullDiskPath).then(() => true).catch(() => false);
    expect(fileExistsBefore).toBe(true);

    await deleteFeedbackImage(uploadedUrl);
    const fileExistsAfter = await fs.access(fullDiskPath).then(() => true).catch(() => false);
    expect(fileExistsAfter).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/feedbackSchema.test.ts`
Expected: FAIL (Cannot find module `@/lib/feedbackStorage` or `prisma.feedback` does not exist)

- [ ] **Step 3: Implement Schema & Storage**

1. In `prisma/schema.prisma`, define:
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
  screenshot String?
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
Add `feedbacks Feedback[]` to `Member`.
Run: `npx prisma db push` and `npx prisma generate`.

2. Create `src/lib/feedbackStorage.ts`:
Implement `saveUploadedFeedbackImage(buffer, mimeType)` saving into `public/uploads/feedback/` and `deleteFeedbackImage(relativeUrl)` safely unlinking files.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/feedbackSchema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/feedbackStorage.ts tests/db/feedbackSchema.test.ts
git commit -m "feat(feedback): add Feedback model to prisma schema and storage helper"
```

---

### Task 3: Feedback Server Actions

**Files:**
- Create: `src/actions/feedbackActions.ts`
- Test: `tests/services/feedbackActions.test.ts`

**Interfaces:**
- Consumes: `prisma.feedback`, `getSessionMember()`, `saveUploadedFeedbackImage`, `deleteFeedbackImage`
- Produces: `submitFeedbackAction(formData: FormData)`, `toggleFeedbackResolvedAction(feedbackId: string)`, `deleteFeedbackAction(feedbackId: string)`

- [ ] **Step 1: Write the failing test**

```ts
// tests/services/feedbackActions.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { submitFeedbackAction, toggleFeedbackResolvedAction, deleteFeedbackAction } from "@/actions/feedbackActions";
import { prisma } from "@/lib/db";

describe("Feedback Actions", () => {
  let createdId: string | null = null;

  beforeEach(async () => {
    if (createdId) {
      await prisma.feedback.deleteMany({ where: { id: createdId } });
      createdId = null;
    }
  });

  it("rejects feedback with message shorter than 3 characters", async () => {
    const formData = new FormData();
    formData.append("message", "hi");
    formData.append("category", "BUG");
    formData.append("pageUrl", "/quizzes");

    const result = await submitFeedbackAction(formData);
    expect(result.success).toBe(false);
    expect(result.error).toContain("te kort");
  });

  it("submits valid feedback and stores it in the database", async () => {
    const formData = new FormData();
    formData.append("message", "Knop werkt niet goed op mobile");
    formData.append("category", "BUG");
    formData.append("pageUrl", "/quizzes/new");
    formData.append("userAgent", "TestBrowser 1.0");

    const result = await submitFeedbackAction(formData);
    expect(result.success).toBe(true);
    expect(result.feedbackId).toBeDefined();
    createdId = result.feedbackId!;

    const item = await prisma.feedback.findUnique({ where: { id: createdId! } });
    expect(item?.message).toBe("Knop werkt niet goed op mobile");
    expect(item?.category).toBe("BUG");
    expect(item?.isResolved).toBe(false);
  });

  it("toggles resolved status and deletes feedback", async () => {
    const item = await prisma.feedback.create({
      data: {
        category: "IDEA",
        message: "Een donkere modus zou cool zijn",
        pageUrl: "/quizzes",
      },
    });
    createdId = item.id;

    // Toggle resolved
    const toggleRes = await toggleFeedbackResolvedAction(item.id);
    expect(toggleRes.success).toBe(true);
    expect(toggleRes.isResolved).toBe(true);

    // Delete
    const deleteRes = await deleteFeedbackAction(item.id);
    expect(deleteRes.success).toBe(true);

    const check = await prisma.feedback.findUnique({ where: { id: item.id } });
    expect(check).toBeNull();
    createdId = null;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/feedbackActions.test.ts`
Expected: FAIL with "Cannot find module '@/actions/feedbackActions'"

- [ ] **Step 3: Implement `src/actions/feedbackActions.ts`**

Implement:
- `submitFeedbackAction(formData)`: reads `message`, `category`, `pageUrl`, `userAgent`, optional screenshot `file`; validates message length >= 3; associates current member if authenticated; creates `Feedback` record; revalidates `/admin/feedback`.
- `toggleFeedbackResolvedAction(feedbackId)`: verifies member is admin, toggles `isResolved` and `resolvedAt`, revalidates `/admin/feedback`.
- `deleteFeedbackAction(feedbackId)`: verifies member is admin, removes screenshot file via `deleteFeedbackImage`, deletes DB record, revalidates `/admin/feedback`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/feedbackActions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/feedbackActions.ts tests/services/feedbackActions.test.ts
git commit -m "feat(feedback): implement feedback submission and management server actions"
```

---

### Task 4: In-App Feedback Widget Client Component with Viewport Capture

**Files:**
- Modify: `package.json` (install `html2canvas`)
- Create: `src/components/FeedbackWidget.tsx`
- Modify: `src/app/layout.tsx:28-34`
- Test: `tests/ui/feedbackWidget.test.tsx`

**Interfaces:**
- Consumes: `submitFeedbackAction`, dynamic `import("html2canvas")`
- Produces: Floating action button + feedback drawer modal mounted globally in the app

- [ ] **Step 1: Install `html2canvas` dependency**

Run: `npm install html2canvas` and `npm install -D @types/html2canvas`

- [ ] **Step 2: Write the failing test**

```tsx
// tests/ui/feedbackWidget.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FeedbackWidget } from "@/components/FeedbackWidget";

// Mock server action
vi.mock("@/actions/feedbackActions", () => ({
  submitFeedbackAction: vi.fn().mockResolvedValue({ success: true, feedbackId: "test-fb-1" }),
}));

describe("FeedbackWidget UI", () => {
  it("renders the floating feedback trigger button", () => {
    render(<FeedbackWidget currentMemberName="Marc" />);
    const trigger = screen.getByRole("button", { name: /Feedback/i });
    expect(trigger).toBeDefined();
  });

  it("opens the modal and allows selecting category and entering text", async () => {
    render(<FeedbackWidget currentMemberName="Marc" />);
    const trigger = screen.getByRole("button", { name: /Feedback/i });
    fireEvent.click(trigger);

    expect(screen.getByText("Meld feedback of een bug")).toBeDefined();

    // Select category Idea
    const ideaButton = screen.getByRole("button", { name: /Idee/i });
    fireEvent.click(ideaButton);

    const textarea = screen.getByPlaceholderText(/Beschrijf wat je ziet/i);
    fireEvent.change(textarea, { target: { value: "Handige nieuwe feature" } });
    expect((textarea as HTMLTextAreaElement).value).toBe("Handige nieuwe feature");

    const submitBtn = screen.getByRole("button", { name: /Versturen/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Bedankt voor je feedback/i)).toBeDefined();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/ui/feedbackWidget.test.tsx`
Expected: FAIL with "Cannot find module '@/components/FeedbackWidget'"

- [ ] **Step 4: Implement `src/components/FeedbackWidget.tsx` and attach to `src/app/layout.tsx`**

1. Create `src/components/FeedbackWidget.tsx`:
- Render floating pill button fixed at bottom-right (`fixed bottom-5 right-5 z-40 bg-slate-900 text-white rounded-full px-4 py-2.5 shadow-lg active:scale-95`).
- When opened:
  - Dynamically load `html2canvas` with `import("html2canvas")`.
  - Capture `document.body` into a canvas element, convert to JPEG Blob (`canvas.toBlob(...)`), and set preview URL.
  - Wrap canvas capture in `try ... catch` to prevent failures on non-DOM test runners or mobile quirks.
  - Display category selector (`BUG`, `IDEA`, `QUESTION`), message textarea, screenshot thumbnail with "Verwijderen", device metadata indicator, and Submit/Cancel buttons.
  - On submit: call `submitFeedbackAction` with `FormData`.
  - On success: show confirmation toast and auto-close after 2 seconds.
2. In `src/app/layout.tsx`, render `<FeedbackWidget />`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ui/feedbackWidget.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/FeedbackWidget.tsx src/app/layout.tsx tests/ui/feedbackWidget.test.tsx
git commit -m "feat(feedback): add floating FeedbackWidget with html2canvas viewport capture"
```

---

### Task 5: Central Admin Hub (`/admin`) & Dashboard Navigation

**Files:**
- Create: `src/app/admin/page.tsx`
- Modify: `src/components/QuizzesDashboard.tsx:28-58`
- Test: `tests/ui/adminNav.test.tsx`

**Interfaces:**
- Consumes: `getSessionMember()`, `prisma.feedback.count({ where: { isResolved: false } })`
- Produces: `/admin` page and Admin navigation link in header

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/adminNav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

describe("Admin Navigation Header", () => {
  it("renders Beheer link when user is admin", () => {
    render(<QuizzesDashboard initialQuizzes={[]} isAdmin={true} />);
    const adminLink = screen.getByRole("link", { name: /Beheer/i });
    expect(adminLink.getAttribute("href")).toBe("/admin");
  });

  it("does not render Beheer link when user is not admin", () => {
    render(<QuizzesDashboard initialQuizzes={[]} isAdmin={false} />);
    expect(screen.queryByRole("link", { name: /Beheer/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/adminNav.test.tsx`
Expected: FAIL with "Unable to find an element with the role 'link' and name `/Beheer/i`"

- [ ] **Step 3: Implement `/admin/page.tsx` and header link in `QuizzesDashboard.tsx`**

1. Create `src/app/admin/page.tsx`:
- Server component checking `getSessionMember()`. If role is not `ADMIN`, redirect to `/quizzes`.
- Query `openFeedbackCount` from `prisma.feedback.count({ where: { isResolved: false } })`.
- Query `totalMembers` from `prisma.member.count()`.
- Query default team name from `prisma.teamSetting`.
- Render a clean back-office dashboard with cards:
  - **Feedback & Meldingen** (`/admin/feedback`) with badge showing open feedback count.
  - **Vrienden & PIN Beheer** (`/admin/members`) showing total members count.
  - **Teaminstellingen** (`/admin/settings`) showing current team name.
  - "← Terug naar KwisAgenda" link to `/quizzes`.
2. In `src/app/quizzes/page.tsx`: pass `isAdmin={currentMember.role === "ADMIN"}` to `QuizzesDashboard`.
3. In `src/components/QuizzesDashboard.tsx`: add prop `isAdmin?: boolean` and render the "Beheer" link button next to "Nieuwe Quiz" when `isAdmin` is true.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/adminNav.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/app/quizzes/page.tsx src/components/QuizzesDashboard.tsx tests/ui/adminNav.test.tsx
git commit -m "feat(admin): create central /admin hub and add Beheer header link"
```

---

### Task 6: Admin Feedback Review Back-Office (`/admin/feedback`)

**Files:**
- Create: `src/app/admin/feedback/page.tsx`
- Create: `src/components/AdminFeedbackClient.tsx`
- Test: `tests/ui/adminFeedbackView.test.tsx`

**Interfaces:**
- Consumes: `prisma.feedback.findMany(...)`, `toggleFeedbackResolvedAction`, `deleteFeedbackAction`
- Produces: Desktop back-office page `/admin/feedback` for filtering, viewing screenshots, and resolving feedback

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/adminFeedbackView.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AdminFeedbackClient } from "@/components/AdminFeedbackClient";

describe("AdminFeedbackClient View", () => {
  const dummyFeedbacks = [
    {
      id: "fb-1",
      category: "BUG",
      message: "Layout glitch on iOS",
      pageUrl: "/quizzes/new",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      screenshot: "/uploads/feedback/test-shot.jpg",
      isResolved: false,
      createdAt: new Date("2026-10-25T10:00:00Z"),
      member: { name: "Marc" },
    },
    {
      id: "fb-2",
      category: "IDEA",
      message: "Add dark mode toggle",
      pageUrl: "/quizzes",
      userAgent: "Mozilla/5.0 (Macintosh)",
      screenshot: null,
      isResolved: true,
      createdAt: new Date("2026-10-24T12:00:00Z"),
      member: { name: "Tom" },
    },
  ];

  it("renders feedback list and filters between open and resolved", () => {
    render(<AdminFeedbackClient initialFeedbacks={dummyFeedbacks as any} />);

    expect(screen.getByText("Layout glitch on iOS")).toBeDefined();
    expect(screen.getByText("Add dark mode toggle")).toBeDefined();

    // Filter to Open only
    const openTab = screen.getByRole("button", { name: /Openstaand/i });
    fireEvent.click(openTab);

    expect(screen.getByText("Layout glitch on iOS")).toBeDefined();
    expect(screen.queryByText("Add dark mode toggle")).toBeNull();
  });

  it("shows image thumbnail and opens screenshot lightbox modal when clicked", () => {
    render(<AdminFeedbackClient initialFeedbacks={dummyFeedbacks as any} />);

    const thumbnail = screen.getByAltText(/Screenshot voor fb-1/i);
    expect(thumbnail).toBeDefined();

    fireEvent.click(thumbnail);
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Screenshot bekijken/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/adminFeedbackView.test.tsx`
Expected: FAIL with "Cannot find module '@/components/AdminFeedbackClient'"

- [ ] **Step 3: Implement `src/app/admin/feedback/page.tsx` and `src/components/AdminFeedbackClient.tsx`**

1. Create `src/app/admin/feedback/page.tsx`:
- Guard with `getSessionMember()`; redirect non-admins to `/quizzes`.
- Query `prisma.feedback.findMany({ include: { member: true }, orderBy: { createdAt: "desc" } })`.
- Render page header with back link to `/admin` and mount `<AdminFeedbackClient initialFeedbacks={feedbacks} />`.
2. Create `src/components/AdminFeedbackClient.tsx`:
- Provide filter tabs: "Alle", "Openstaand", "Opgelost", plus category filters (*Bugs*, *Ideeën*, *Vragen*).
- Display items with European date & time (`formatEuropeanDateTime`), category badge (red for BUG, amber for IDEA, blue for QUESTION), member name, device user agent preview, and route URL.
- Show screenshot thumbnail if present, with click-to-open fullscreen image lightbox.
- Action buttons: "Markeer als opgelost" / "Heropenen" calling `toggleFeedbackResolvedAction`, and "Verwijderen" calling `deleteFeedbackAction`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/adminFeedbackView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/feedback/page.tsx src/components/AdminFeedbackClient.tsx tests/ui/adminFeedbackView.test.tsx
git commit -m "feat(admin): build /admin/feedback management back-office view with screenshot lightbox"
```

---

### Task 7: Full Verification & User Remarks Documentation Update

**Files:**
- Modify: `docs/superpowers/feedback/user-test-remarks.md:109-140`

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: All test suites PASS (including all existing 22 files and the 5 newly added test files).

- [ ] **Step 2: Run production Next.js build verification**

Run: `npm run build`
Expected: Production build succeeds with 0 errors.

- [ ] **Step 3: Update `docs/superpowers/feedback/user-test-remarks.md`**

Mark Item 15 and Item 16 as `Status: Completed`, detailing the implementation and test coverage.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/feedback/user-test-remarks.md
git commit -m "docs: mark item 15 and 16 as completed in user-test-remarks"
```
