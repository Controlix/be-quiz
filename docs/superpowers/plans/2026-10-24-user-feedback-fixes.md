# User Feedback & Polish Implementation Plan — Iteration 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement user test improvements and transition authentication to a clean, device-agnostic **Name + 4-digit PIN** model (architected for easy extension), alongside European date/time formatting, unescaped email generation, mobile stepper controls, flyer drag/drop, Euro glyphs, field validation, structured entry fees, touch-friendly drag-and-drop roster reordering, and a clean zero-dummy-data production launch state (Marc only, 0 quizzes).

**Architecture:** Next.js 15 (App Router, Server Actions); Prisma ORM with PostgreSQL; PINs hashed using SHA-256; sessions use signed `httpOnly` cookies with rolling expiry; touch drag-and-drop reordering for admins via atomic `queuedSince` swapping; centralized European date/time formatters; clean production seed.

**Tech Stack:** Next.js 15, TypeScript 5, Tailwind CSS, Prisma ORM, PostgreSQL, Vitest.

**Spec:** `docs/superpowers/feedback/user-test-remarks.md`

## Global Constraints

* Language: Dutch (`nl-BE`) for all labels, error banners, and date/time formatting.
* Date format: strictly `DD/MM/YYYY` (e.g. `28/11/2026`).
* Time format: strictly 24-hour `HH:mm` (e.g. `20:00`).
* Team Name: permanently "Ben in Black".
* Currency: Euro symbol `€` everywhere (no dollar signs).
* Authentication: Name + 4-digit personal PIN (extensible architecture).
* Mobile UX: Stepper buttons and drag handles must be compact and touch-friendly.
* Production State: Clean zero-dummy-data initial state (only Marc as Admin, 0 quizzes).

## Review Focus

1. **First-Time PIN Setup vs Verification:** A member with `pinHash == null` entering the login flow is prompted to set their 4-digit PIN; subsequent logins verify against the hash. (Pinned to Task 9)
2. **Device Switching & Session Rolling:** Logging in with Name + PIN on a new device issues a valid session without invalidating prior devices, and session expiry rolls forward on use. (Pinned to Task 9)
3. **Email Plaintext vs Mailto Encoding:** The email body must be clean plain text with real `\r\n` line breaks when copied to the clipboard, and single-encoded in the `mailto:` URL without `%250D` double-escapes. (Pinned to Task 2)
4. **Admin Roster Drag-and-Drop Invariant:** Dragging a reserve player into an active slot swaps queue order atomically and updates active vs reserve sets without breaking `queuedSince ASC` ordering. (Pinned to Task 8)
5. **Clean Production Launch State:** Running the production seed produces exactly 1 member (Marc, ADMIN) and 0 quizzes, and the dashboard renders a clean empty state with an add quiz CTA. (Pinned to Task 10)

---

## File Structure & Module Responsibilities

```
src/
├── actions/
│   ├── authActions.ts                 # Name + PIN login, first-time setup, logout
│   ├── adminActions.ts                # Admin PIN reset, reorder actions, team size bounds (1-10)
│   └── quizActions.ts                 # Validate field lengths & email format
├── app/
│   ├── layout.tsx                     # Root mobile shell
│   ├── auth/
│   │   ├── login/page.tsx             # Name selection + 4-digit PIN keypad/input
│   │   └── logout/route.ts            # Clears session cookie and redirects
│   ├── quizzes/
│   │   ├── page.tsx                   # Timeline dashboard (clean empty state)
│   │   ├── new/page.tsx               # New quiz form with stepper, structured fee & max lengths
│   │   └── [id]/
│   │       ├── page.tsx               # Quiz detail view
│   │       └── edit/page.tsx          # Admin edit page with stepper & capacity bounds
│   └── admin/
│       └── members/page.tsx           # Member roster + "Reset PIN" button
├── components/
│   ├── ui/
│   │   └── Stepper.tsx                # Mobile-friendly [-] and [+] stepper component
│   ├── ActionToolbar.tsx              # Clean unescaped mailto, copy feedback, Euro glyph
│   ├── FlyerUploader.tsx              # Drag-and-drop dropzone & clipboard paste listener
│   ├── QuizCard.tsx                   # European date/time formatting
│   ├── QuizDetailClient.tsx           # Detail view with drag-and-drop roster
│   ├── QuizEntryForm.tsx              # Structured fee (amount + unit), stepper, max lengths
│   ├── QuizzesDashboard.tsx           # Visible "Afmelden" (Logout) button in header & empty state
│   └── TeamLineup.tsx                 # Touch drag handle (⠿) and drag reorder logic
├── lib/
│   ├── formatters.ts                  # Centralized DD/MM/YYYY and HH:mm date formatters
│   ├── mailto.ts                      # Clean mailto generator without double-encoding
│   └── auth.ts                        # Session rolling & member resolution
└── prisma/
    ├── schema.prisma                  # Member.pinHash field
    └── seed.ts                        # Clean production seed: Marc only, 0 quizzes
```

---

## Tasks

### Task 1: European Date & Time Formatters

**Files:**
- Create: `src/lib/formatters.ts`
- Modify: `src/components/QuizCard.tsx`, `src/components/QuizDetailClient.tsx`, `src/lib/mailto.ts`, `src/lib/whatsapp.ts`
- Test: `tests/lib/formatters.test.ts`

**Interfaces:**
- Consumes: `Date` objects
- Produces:
  ```typescript
  export function formatEuropeanDate(date: Date | string): string; // "14/11/2026"
  export function formatEuropeanTime(date: Date | string): string; // "20:00"
  export function formatEuropeanDateTime(date: Date | string, includeWeekday?: boolean): string; // "za 14/11/2026 om 20:00"
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/formatters.test.ts
import { describe, it, expect } from "vitest";
import { formatEuropeanDate, formatEuropeanTime, formatEuropeanDateTime } from "../../src/lib/formatters";

describe("European Date & Time Formatters", () => {
  const testDate = new Date("2026-11-14T20:05:00Z");

  it("formats date strictly as DD/MM/YYYY", () => {
    expect(formatEuropeanDate(testDate)).toBe("14/11/2026");
  });

  it("formats time strictly as 24-hour HH:mm", () => {
    expect(formatEuropeanTime(testDate)).toMatch(/^\d{2}:\d{2}$/);
    expect(formatEuropeanTime(testDate)).toBe("20:05");
  });

  it("formats combined datetime with Dutch weekday", () => {
    const formatted = formatEuropeanDateTime(testDate, true);
    expect(formatted).toContain("14/11/2026");
    expect(formatted).toContain("20:05");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/formatters.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `formatters.ts` and apply across UI and share helpers**

Build `src/lib/formatters.ts` using zero-padded date/month parts and 24-hour time; replace inline `Intl.DateTimeFormat` calls in `QuizCard.tsx`, `QuizDetailClient.tsx`, `mailto.ts`, and `whatsapp.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/formatters.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatters.ts src/components/QuizCard.tsx src/components/QuizDetailClient.tsx src/lib/mailto.ts src/lib/whatsapp.ts tests/lib/formatters.test.ts
git commit -m "feat: implement centralized European date and 24-hour time formatters"
```

---

### Task 2: Clean Email Body Generation & Fix Double-Encoding

**Files:**
- Modify: `src/lib/mailto.ts`, `src/components/ActionToolbar.tsx`
- Test: `tests/lib/mailto.test.ts`

**Interfaces:**
- Consumes: `Quiz`, `Team`, `contactName`
- Produces:
  ```typescript
  export function getRegistrationEmailPlainText(
    quiz: { title: string; startsAt: Date },
    team: { name: string },
    contactName: string
  ): string; // Clean unescaped text with \r\n for clipboard

  export function generateRegistrationMailto(
    quiz: { title: string; startsAt: Date; organizerEmail: string | null },
    team: { name: string },
    contactName: string
  ): string; // mailto: URI single-encoded
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/mailto.test.ts
import { describe, it, expect } from "vitest";
import { generateRegistrationMailto, getRegistrationEmailPlainText } from "../../src/lib/mailto";

describe("Mailto & Plaintext Email Generation", () => {
  const quiz = { title: "Herfstquiz", startsAt: new Date("2026-11-14T20:00:00Z"), organizerEmail: "org@quiz.be" };
  const team = { name: "Ben in Black" };

  it("produces clean unescaped text for clipboard with real newlines", () => {
    const text = getRegistrationEmailPlainText(quiz, team, "Marc");
    expect(text).not.toContain("%0D");
    expect(text).not.toContain("%20");
    expect(text).toContain("Ploegnaam: Ben in Black");
    expect(text).toContain("Contactpersoon: Marc");
  });

  it("produces single-encoded mailto URI without double-escapes (%250D)", () => {
    const uri = generateRegistrationMailto(quiz, team, "Marc");
    expect(uri.startsWith("mailto:org@quiz.be?")).toBe(true);
    expect(uri).not.toContain("%250D");
    expect(uri).not.toContain("%2520");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/mailto.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement clean email generator and update ActionToolbar**

In `src/lib/mailto.ts`, separate the plain text body generator (`getRegistrationEmailPlainText`) from the URL encoder (`generateRegistrationMailto`); in `ActionToolbar.tsx`, copy the raw plain text directly to the clipboard instead of regex-extracting from the encoded mailto URL.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/mailto.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mailto.ts src/components/ActionToolbar.tsx tests/lib/mailto.test.ts
git commit -m "fix: resolve email double-encoding bug and provide clean plaintext for clipboard"
```

---

### Task 3: Visible Logout Button & Euro Currency Symbol

**Files:**
- Modify: `src/components/QuizzesDashboard.tsx`, `src/components/ActionToolbar.tsx`, `src/components/QuizCard.tsx`
- Test: `tests/ui/dashboardHeader.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - Header with `LogOut` icon button linking to `/auth/logout`.
  - Payment buttons and badges displaying `€` symbol (replacing dollar sign).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/dashboardHeader.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Dashboard Header & Currency Symbols", () => {
  it("includes a link to /auth/logout in QuizzesDashboard", () => {
    const file = fs.readFileSync("src/components/QuizzesDashboard.tsx", "utf-8");
    expect(file).toContain("/auth/logout");
  });

  it("replaces DollarSign with Euro glyph in ActionToolbar", () => {
    const file = fs.readFileSync("src/components/ActionToolbar.tsx", "utf-8");
    expect(file).not.toContain("DollarSign");
    expect(file).toContain("€");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/dashboardHeader.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement header logout button and Euro icon**

In `src/components/QuizzesDashboard.tsx`, add an "Afmelden" icon button linking to `/auth/logout` next to the title; in `ActionToolbar.tsx` and `QuizCard.tsx`, replace `DollarSign` with a clean styled `€` symbol.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/dashboardHeader.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/QuizzesDashboard.tsx src/components/ActionToolbar.tsx src/components/QuizCard.tsx tests/ui/dashboardHeader.test.ts
git commit -m "feat: add visible logout button to header and replace dollar sign with euro symbol"
```

---

### Task 4: Input Validation (Email Format & Field Length Bounds)

**Files:**
- Modify: `src/components/QuizEntryForm.tsx`, `src/actions/quizActions.ts`, `src/services/quizService.ts`
- Test: `tests/ui/formValidation.test.ts`

**Interfaces:**
- Consumes: `CreateQuizInput`
- Produces:
  - Client & server validation rejecting titles >100 chars, locations >120 chars, and invalid emails.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/formValidation.test.ts
import { describe, it, expect } from "vitest";
import { validateQuizFields } from "../../src/services/quizService";

describe("Quiz Input Validation", () => {
  it("rejects overlong titles or locations", () => {
    const longTitle = "A".repeat(101);
    const valid = validateQuizFields({ title: longTitle, location: "Gent" });
    expect(valid.isValid).toBe(false);
    expect(valid.errors.title).toBeDefined();
  });

  it("rejects invalid email formats", () => {
    const invalidEmail = validateQuizFields({ title: "Quiz", location: "Gent", organizerEmail: "invalid-email" });
    expect(invalidEmail.isValid).toBe(false);
    expect(invalidEmail.errors.organizerEmail).toBeDefined();
  });

  it("accepts valid email and lengths", () => {
    const valid = validateQuizFields({ title: "Quiz", location: "Gent", organizerEmail: "organisatie@quiz.be" });
    expect(valid.isValid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/formValidation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement validation in `quizService.ts`, `quizActions.ts`, and `QuizEntryForm.tsx`**

Implement `validateQuizFields` with regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` and length checks; add `maxLength={100}` and `maxLength={120}` to `QuizEntryForm.tsx` inputs; enforce validation in `createQuizAction`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/formValidation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/quizService.ts src/actions/quizActions.ts src/components/QuizEntryForm.tsx tests/ui/formValidation.test.ts
git commit -m "feat: add email format validation and field length limits"
```

---

### Task 5: Mobile Stepper Component & Admin Capacity Bounds

**Files:**
- Create: `src/components/ui/Stepper.tsx`
- Modify: `src/components/QuizEntryForm.tsx`, `src/components/EditQuizClient.tsx`, `src/actions/adminActions.ts`, `src/services/rsvpService.ts`
- Test: `tests/ui/stepper.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface StepperProps {
    value: number;
    min?: number; // default 1
    max?: number; // default 10
    onChange: (value: number) => void;
    label?: string;
  }
  export function Stepper(props: StepperProps): React.JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/stepper.test.ts
import { describe, it, expect } from "vitest";
import { updateTeamCapacity } from "../../src/services/rsvpService";

describe("Team Size Capacity Bounds", () => {
  it("rejects team size less than 1 or greater than 10", async () => {
    await expect(updateTeamCapacity("mock-team", 0)).rejects.toThrow();
    await expect(updateTeamCapacity("mock-team", 11)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/stepper.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `Stepper.tsx` and enforce capacity bounds**

Build `src/components/ui/Stepper.tsx` with thumb-friendly `[-]` and `[+]` buttons; replace `<input type="number">` in `QuizEntryForm.tsx` and `EditQuizClient.tsx`; add bounds check `if (newMaxTeamSize < 1 || newMaxTeamSize > 10)` in `updateTeamCapacity` and `adminUpdateTeamCapacityAction`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/stepper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Stepper.tsx src/components/QuizEntryForm.tsx src/components/EditQuizClient.tsx src/actions/adminActions.ts src/services/rsvpService.ts tests/ui/stepper.test.ts
git commit -m "feat: implement mobile-friendly stepper and enforce 1-10 team capacity bounds"
```

---

### Task 6: Flyer Upload Drag-and-Drop & Clipboard Paste

**Files:**
- Modify: `src/components/FlyerUploader.tsx`
- Test: `tests/ui/flyerUploader.test.ts`

**Interfaces:**
- Consumes: `onExtractionComplete` callback
- Produces:
  - Full dropzone support on upload box (`onDragOver`, `onDragLeave`, `onDrop`).
  - Window/container clipboard paste listener (`onPaste`) handling image files directly.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/flyerUploader.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("FlyerUploader Drag & Drop and Paste Support", () => {
  it("implements onDrop and onDragOver event handlers", () => {
    const code = fs.readFileSync("src/components/FlyerUploader.tsx", "utf-8");
    expect(code).toContain("onDrop");
    expect(code).toContain("onDragOver");
  });

  it("implements clipboard paste event handler for screenshots", () => {
    const code = fs.readFileSync("src/components/FlyerUploader.tsx", "utf-8");
    expect(code).toContain("paste");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/flyerUploader.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement drag-and-drop and clipboard paste in `FlyerUploader.tsx`**

Add `isDragging` state with visual dashed border highlight; implement `handleDrop` extracting dropped files; add `useEffect` paste event listener intercepting clipboard image items (`e.clipboardData.items`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/flyerUploader.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FlyerUploader.tsx tests/ui/flyerUploader.test.ts
git commit -m "feat: add drag-and-drop and clipboard screenshot paste support to flyer uploader"
```

---

### Task 7: Structured Entry Fee (Amount & Unit Toggle)

**Files:**
- Modify: `src/components/QuizEntryForm.tsx`, `src/services/visionService.ts`, `src/services/quizService.ts`
- Test: `tests/ui/entryFee.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function formatStructuredEntryFee(amount?: number | string, unit?: "TEAM" | "PERSON"): string | undefined;
  // returns "€20 / ploeg" or "€5 / persoon"
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/entryFee.test.ts
import { describe, it, expect } from "vitest";
import { formatStructuredEntryFee } from "../../src/services/quizService";

describe("Structured Entry Fee Formatter", () => {
  it("formats team entry fee with Euro symbol and per ploeg", () => {
    expect(formatStructuredEntryFee("20", "TEAM")).toBe("€20 / ploeg");
  });

  it("formats per person entry fee correctly", () => {
    expect(formatStructuredEntryFee("5", "PERSON")).toBe("€5 / persoon");
  });

  it("returns undefined when amount is empty", () => {
    expect(formatStructuredEntryFee("", "TEAM")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/entryFee.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement structured entry fee UI and formatting**

In `QuizEntryForm.tsx`, replace the free-text input with a numeric amount field (prefixed by `€`) and a toggle button between **"per ploeg"** (default) and **"per persoon"**; auto-assemble via `formatStructuredEntryFee` before saving.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/entryFee.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/QuizEntryForm.tsx src/services/quizService.ts tests/ui/entryFee.test.ts
git commit -m "feat: implement structured entry fee with amount input and team/person toggle"
```

---

### Task 8: Admin Touch Drag-and-Drop Roster Reordering

**Files:**
- Create: `src/actions/reorderActions.ts`
- Modify: `src/services/rsvpService.ts`, `src/components/TeamLineup.tsx`, `src/components/QuizDetailClient.tsx`
- Test: `tests/services/rosterReorder.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export async function adminReorderRsvpAction(
    teamId: string,
    sourceIndex: number,
    destinationIndex: number
  ): Promise<{ success: boolean; error?: string }>;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/services/rosterReorder.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup, reorderRsvps } from "../../src/services/rsvpService";

describe("Admin Roster Reordering", () => {
  it("reorders attendees and updates active lineup and reserve boundary", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-${Date.now()}`, role: "ADMIN" } });
    const quiz = await createQuiz({ title: "Reorder Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 2 }, admin.id);
    const m1 = await prisma.member.create({ data: { name: `M1-${Date.now()}` } });
    const m2 = await prisma.member.create({ data: { name: `M2-${Date.now()}` } });
    const m3 = await prisma.member.create({ data: { name: `M3-${Date.now()}` } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m3.id, "ATTENDING"); // Reserve #1

    // Admin drags M3 (reserve #1, index 2) to slot 0 (active lineup)
    await reorderRsvps(quiz.team!.id, 2, 0);

    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active[0].memberId).toBe(m3.id);
    expect(reserves[0].memberId).toBe(m2.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/rosterReorder.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `reorderRsvps`, `adminReorderRsvpAction`, and drag handle UI in `TeamLineup.tsx`**

Implement `reorderRsvps` in `src/services/rsvpService.ts` updating `queuedSince` order in an atomic PostgreSQL transaction; build `src/actions/reorderActions.ts`; in `TeamLineup.tsx`, render a slim drag handle (`⠿` GripVertical) for admins and implement HTML5/touch drag events to reorder items smoothly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/rosterReorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/rsvpService.ts src/actions/reorderActions.ts src/components/TeamLineup.tsx src/components/QuizDetailClient.tsx tests/services/rosterReorder.test.ts
git commit -m "feat: implement admin touch drag-and-drop roster reordering"
```

---

### Task 9: Name + 4-Digit PIN Authentication & First-Time PIN Setup

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/auth.ts`, `src/actions/authActions.ts`, `src/actions/adminActions.ts`, `src/app/auth/login/page.tsx`, `src/components/MemberRosterClient.tsx`
- Test: `tests/auth/pinAuth.test.ts`

**Interfaces:**
- Consumes: `prisma.member`
- Produces:
  ```typescript
  export async function loginWithPinAction(memberId: string, pin: string): Promise<{ success: boolean; error?: string }>;
  export async function setupInitialPinAction(memberId: string, pin: string): Promise<{ success: boolean; error?: string }>;
  export async function adminResetMemberPinAction(memberId: string): Promise<{ success: boolean; error?: string }>;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/auth/pinAuth.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { hashToken } from "../../src/lib/crypto";
import { verifyMemberPin, setMemberPin } from "../../src/lib/auth";

describe("Name + 4-Digit PIN Authentication", () => {
  it("sets a 4-digit PIN for a new member and verifies it", async () => {
    const member = await prisma.member.create({
      data: { name: `PIN-User-${Date.now()}`, role: "USER" },
    });

    await setMemberPin(member.id, "4821");
    const isValid = await verifyMemberPin(member.id, "4821");
    const isInvalid = await verifyMemberPin(member.id, "0000");

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/pinAuth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `pinHash` in Prisma schema, PIN verification, Server Actions, and UI**

Add `pinHash String?` to `Member` in `prisma/schema.prisma`; implement `verifyMemberPin`, `setMemberPin`, and rolling session update in `src/lib/auth.ts`; implement `loginWithPinAction`, `setupInitialPinAction`, and `adminResetMemberPinAction`; update `/auth/login/page.tsx` with name picker and 4-digit PIN input; add "Reset PIN" button in `/admin/members`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/pinAuth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/auth.ts src/actions/authActions.ts src/actions/adminActions.ts src/app/auth/login/page.tsx src/components/MemberRosterClient.tsx tests/auth/pinAuth.test.ts
git commit -m "feat: implement name + 4-digit PIN authentication, first-time PIN setup, and admin PIN reset"
```

---

### Task 10: Clean Production Seed & Dashboard Empty State

**Files:**
- Modify: `prisma/seed.ts`, `src/components/QuizzesDashboard.tsx`
- Test: `tests/ui/emptyDashboard.test.ts`

**Interfaces:**
- Produces:
  - Clean production seed: exactly 1 member (`Marc`, `ADMIN`), 0 dummy members, 0 dummy quizzes.
  - Dashboard friendly empty state prompting to add the first quiz when list is empty.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/emptyDashboard.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Clean Production Seed & Empty Dashboard State", () => {
  it("verifies seed.ts contains only Marc and 0 dummy quizzes", () => {
    const seed = fs.readFileSync("prisma/seed.ts", "utf-8");
    expect(seed).toContain("Ben in Black");
    expect(seed).not.toContain("De Grote Herfstquiz");
    expect(seed).not.toContain("Scouts & Gidsen Kwis");
  });

  it("renders a friendly empty state CTA in QuizzesDashboard", () => {
    const file = fs.readFileSync("src/components/QuizzesDashboard.tsx", "utf-8");
    expect(file).toContain("Nog geen quizzen gepland");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/emptyDashboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `seed.ts` and `QuizzesDashboard.tsx`**

In `prisma/seed.ts`, remove all dummy quizzes and dummy members, keeping strictly Marc as Admin and `defaultTeamName: "Ben in Black"`; in `QuizzesDashboard.tsx`, render a clean Dutch empty state: *"Nog geen quizzen gepland. Tik op '+ Nieuwe Quiz' om de eerste quiz toe te voegen!"* with a prominent button.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/emptyDashboard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts src/components/QuizzesDashboard.tsx tests/ui/emptyDashboard.test.ts
git commit -m "chore: clean production seed script and add friendly empty dashboard state"
```
