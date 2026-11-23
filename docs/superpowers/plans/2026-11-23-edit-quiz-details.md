# Edit Quiz Details (Collaborative Error Correction) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable any authenticated teammate (`USER` or `ADMIN`) to manually edit core quiz metadata (`title`, `startsAt`, `location`, `organizerEmail`, `entryFee`) via a modal dialog on `/quizzes/[id]` while preserving existing start-time locks and keeping admin governance on `/quizzes/[id]/edit` strictly `ADMIN`-only.

**Architecture:** Extract shared metadata form fields (`QuizMetadataFields`) and entry-fee parsing (`parseStructuredEntryFee`) from `QuizEntryForm` so creation and editing share identical validation and European formatting. Add a locked-down Server Action `updateQuizDetailsAction` calling `updateQuizDetails()`, wire a wrapper-remount `EditQuizDialog` onto `QuizDetailClient` backed by a single `quizDetails` state object, and verify everything in Vitest (`environment: "node"`) plus `npm run check:all`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Prisma 6 + PostgreSQL, Tailwind CSS v4, Lucide React, date-fns 4, Vitest 5 (`environment: "node"`), Knip.

**Spec:** [docs/superpowers/specs/2026-11-23-edit-quiz-details-design.md](../specs/2026-11-23-edit-quiz-details-design.md)

## Global Constraints

- **No Git Commits Without Consent:** NEVER run `git commit` inside implementation tasks unless the user explicitly asks for a commit.
- **No Schema Migrations or Hidden Fields:** Do not modify `prisma/schema.prisma`, and do not expose `registrationUrl`, `notes`, or flyer replacement/AI re-scan.
- **Governance Separation:** `updateQuizDetailsAction` must strictly accept and update only `{ title, startsAt, location, organizerEmail, entryFee }`—never `maxTeamSize`, `status`, or `flyerImageUrl`.
- **Single Source of Truth & Non-Optimistic Updates:** `QuizDetailClient` maintains one `quizDetails` state object and updates it only after `updateQuizDetailsAction` resolves `{ success: true, quiz }`.
- **Non-Fatal Cache Revalidation:** Wrap `revalidatePath` calls in `updateQuizDetailsAction` inside an inner `try { ... } catch {}` block so Vitest Node runs outside Next.js request context never fail falsely.
- **Node-Only Deterministic Testing:** Vitest runs under `environment: "node"` (no `@testing-library/react` or `jsdom`); component markup tests use `renderToStaticMarkup` and local `new Date(year, monthIndex, day, hour, minute)` constructors.
- **Blocking Verification Gate:** `npm run check:all` (`typecheck`, `test`, `lint`, `format:check`, `audit:check`, `scan:secrets`, `knip`, `knip:prod`) must pass with zero warnings/errors.

## Review Focus

1. **Clearing optional fields (`organizerEmail`, `entryFee`) must persist `null` rather than `undefined`:** When a user clears email or fee in `EditQuizDialog` and saves, `updateQuizDetailsAction` must write `null` to PostgreSQL instead of skipping the field. _(Pinned in Task 3)_
2. **Invalid or missing `startsAt` (`null`, `""`, `"invalid-date"`) must be rejected before Prisma update:** `new Date(null as any)` evaluates to `1970-01-01` rather than `NaN`; `updateQuizDetailsAction` must reject falsy or unparseable `startsAt` values cleanly. _(Pinned in Task 3)_
3. **Start-time and status lockdown (`isQuizLockedForUser`) must hold identically on both Server Action and UI:** Regular `USER` accounts must be blocked from editing once `startsAt <= now` or when status is `CANCELLED`/`ARCHIVED`, while `ADMIN` accounts keep full post-start edit access. _(Pinned in Task 3 & Task 5)_
4. **Legacy/freeform or `null` `entryFee` values must pre-populate safely without crashing:** Existing quizzes with `null`, `"gratis"`, `"5 pp"`, or `"€20 / ploeg"` must parse deterministically into `{ amount, unit }` with `"TEAM"` vs `"PERSON"` state reflected via `aria-pressed`. _(Pinned in Task 1 & Task 4)_
5. **`EditQuizDialog` must pre-populate synchronously under `renderToStaticMarkup` and reset dirty state/errors on close:** Using the wrapper-remount pattern (`if (!props.isOpen) return null; return <EditQuizDialogContent {...props} />;`) guarantees pre-populated SSR markup and clean state reset without `useEffect`. _(Pinned in Task 4)_

---

### Task 1: Shared Entry Fee Parser & Formatter Visibility

**Files:**

- Modify: `src/services/quizService.ts:18-31,169-220`
- Modify: `src/lib/formatters.ts:1-17`
- Test: `tests/ui/entryFee.test.ts`

**Interfaces:**

- Consumes: Existing `formatStructuredEntryFee` in `src/services/quizService.ts`.
- Produces:
  - `parseStructuredEntryFee(entryFee?: string | null): { amount: string; unit: "TEAM" | "PERSON" }` in `src/services/quizService.ts`
  - Public (non-`@internal`) `UpdateQuizDetailsInput` and `updateQuizDetails` in `src/services/quizService.ts`
  - Public (non-`@internal`) `formatEuropeanDate` and `formatEuropeanTime` in `src/lib/formatters.ts`

- [x] **Step 1: Write the failing unit tests for `parseStructuredEntryFee` in `tests/ui/entryFee.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatStructuredEntryFee, parseStructuredEntryFee } from "../../src/services/quizService";

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

  it("parses formatted team and person entry fees back into amount and unit", () => {
    expect(parseStructuredEntryFee("€20 / ploeg")).toEqual({ amount: "20", unit: "TEAM" });
    expect(parseStructuredEntryFee("€5 / persoon")).toEqual({ amount: "5", unit: "PERSON" });
    expect(parseStructuredEntryFee("15 pp")).toEqual({ amount: "15", unit: "PERSON" });
    expect(parseStructuredEntryFee("€12,50 p.p.")).toEqual({ amount: "12,50", unit: "PERSON" });
  });

  it("returns empty amount and TEAM default for null, empty, or non-numeric strings", () => {
    expect(parseStructuredEntryFee(null)).toEqual({ amount: "", unit: "TEAM" });
    expect(parseStructuredEntryFee("")).toEqual({ amount: "", unit: "TEAM" });
    expect(parseStructuredEntryFee("gratis")).toEqual({ amount: "", unit: "TEAM" });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/entryFee.test.ts`
Expected: FAIL because `parseStructuredEntryFee` is not exported from `src/services/quizService.ts`.

- [x] **Step 3: Implement `parseStructuredEntryFee` and remove `/** @internal */` tags**

In `src/services/quizService.ts`:

- Export `parseStructuredEntryFee(entryFee?: string | null): { amount: string; unit: "TEAM" | "PERSON" }`:
  - If `!entryFee`, return `{ amount: "", unit: "TEAM" }`.
  - `const unit: "TEAM" | "PERSON" = /persoon|pp|p\.p\./i.test(entryFee) ? "PERSON" : "TEAM";`
  - `const match = entryFee.match(/[0-9]+([.,][0-9]+)?/);`
  - Return `{ amount: match ? match[0] : "", unit }`.
- Remove the `/** @internal */` JSDoc tags above `UpdateQuizDetailsInput` and `updateQuizDetails` (now consumed in production by Task 3).

In `src/lib/formatters.ts`:

- Remove the `/** @internal */` JSDoc tags above `formatEuropeanDate` and `formatEuropeanTime` (now consumed in production by Task 4).

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/entryFee.test.ts tests/lib/formatters.test.ts`
Expected: PASS (all tests in both files pass).

---

### Task 2: Shared `QuizMetadataFields` Extraction & `QuizEntryForm` Reuse

**Files:**

- Create: `src/components/QuizMetadataFields.tsx`
- Modify: `src/components/QuizEntryForm.tsx:1-372`
- Verify against: `tests/components/QuizEntryFormAdaptive.test.tsx`, `tests/ui/formDateInputs.test.tsx`

**Interfaces:**

- Consumes:
  - `parseStructuredEntryFee` from `@/services/quizService`
  - `formatEuropeanDateString`, `formatEuropeanTimeString` from `@/lib/formatters`
- Produces:
  - `QuizMetadataFields` component and `QuizMetadataFieldsProps` interface in `src/components/QuizMetadataFields.tsx`:
    ```ts
    export interface QuizMetadataFieldsProps {
      title: string;
      onTitleChange: (value: string) => void;
      date: string;
      onDateChange: (value: string) => void;
      time: string;
      onTimeChange: (value: string) => void;
      location: string;
      onLocationChange: (value: string) => void;
      organizerEmail: string;
      onOrganizerEmailChange: (value: string) => void;
      entryFeeAmount: string;
      onEntryFeeAmountChange: (value: string) => void;
      entryFeeUnit: "TEAM" | "PERSON";
      onEntryFeeUnitChange: (unit: "TEAM" | "PERSON") => void;
      missingFields?: string[];
      disabled?: boolean;
      teamSizeControl?: React.ReactNode;
    }
    ```

- [x] **Step 1: Create `src/components/QuizMetadataFields.tsx`**

Implement `"use client";` component rendering the exact 6 metadata fields from `QuizEntryForm.tsx`:

- **Title:** `<label htmlFor="quiz-title-input">Kwis Titel *</label>`, `<input id="quiz-title-input" type="text" maxLength={100} ... />` with `disabled={disabled}` and red missing-field styling when `missingFields.includes("title")`.
- **Date & Time:** 2-column grid (`grid-cols-2 gap-2`) with `<label htmlFor="quiz-date-input">Datum (DD/MM/JJJJ) *</label>` (`type="text"`, `inputMode="numeric"`, `maxLength={10}`, `placeholder="DD/MM/JJJJ"`, passing `formatEuropeanDateString(e.target.value)` to `onDateChange`) and `<label htmlFor="quiz-time-input">Aanvangsuur (24u) *</label>` (`type="text"`, `inputMode="numeric"`, `maxLength={5}`, `placeholder="20:00"`, passing `formatEuropeanTimeString(e.target.value)` to `onTimeChange`). Never use native `type="date"` or `type="time"`.
- **Location (+ optional `teamSizeControl`):** Flex row (`flex flex-col gap-3 sm:flex-row`) with `<label htmlFor="quiz-location-input">Locatie / Zaal *</label>` (`maxLength={120}`) in `flex-1`, and `{teamSizeControl}` rendered beside it when provided.
- **Organizer Email & Entry Fee:** 2-column grid (`grid-cols-1 gap-3 sm:grid-cols-2`) with `<label htmlFor="quiz-organizer-email-input">Inschrijf Email</label>` (`type="email"`) and `<label htmlFor="quiz-entry-fee-input">Inschrijvingsgeld</label>` (`inputMode="decimal"`, `maxLength={10}`) paired with plain-text `/ ploeg` (`aria-pressed={entryFeeUnit === "TEAM"}`) and `/ persoon` (`aria-pressed={entryFeeUnit === "PERSON"}`) toggle buttons (`disabled={disabled}`).

- [x] **Step 2: Refactor `src/components/QuizEntryForm.tsx` to consume `QuizMetadataFields` and `parseStructuredEntryFee`**

- In `handleExtraction`, replace lines 59–64 inline regex parsing with:
  ```ts
  if (result.data.entryFee) {
    const parsedFee = parseStructuredEntryFee(result.data.entryFee);
    setEntryFeeAmount(parsedFee.amount);
    setEntryFeeUnit(parsedFee.unit);
  }
  ```
- Replace the duplicated field JSX (lines 208–359) inside `<form>` with `<QuizMetadataFields ... />`, passing the `Max Spelers` `<Stepper />` block via `teamSizeControl` and clearing field names from `missingFields` inside each `on*Change` callback.

- [x] **Step 3: Run existing form tests and typecheck to verify zero regressions**

Run: `npx vitest run tests/components/QuizEntryFormAdaptive.test.tsx tests/ui/formDateInputs.test.tsx tests/ui/formValidation.test.ts && npm run typecheck`
Expected: PASS across all 3 test files and `tsc --noEmit` exits 0.

---

### Task 3: `updateQuizDetailsAction` Server Action & Enforcement

**Files:**

- Modify: `src/actions/quizActions.ts:1-25`
- Create: `tests/actions/editQuizDetailsAction.test.ts`

**Interfaces:**

- Consumes:
  - `getSessionMember` from `@/lib/auth`
  - `isQuizLockedForUser`, `QUIZ_LOCKED_MUTATION_ERROR` from `@/lib/quizLock`
  - `getQuizById`, `updateQuizDetails`, `validateQuizFields` from `@/services/quizService`
  - `revalidatePath` from `next/cache`
- Produces:
  - `UpdateQuizMetadataInput` and `UpdateQuizDetailsActionResult` types in `src/actions/quizActions.ts`
  - `updateQuizDetailsAction(quizId: string, rawInput: UpdateQuizMetadataInput): Promise<UpdateQuizDetailsActionResult>` in `src/actions/quizActions.ts`

- [x] **Step 1: Write the failing Server Action tests in `tests/actions/editQuizDetailsAction.test.ts`**

Cover all auth, lockdown, validation, clearing, governance isolation, and domain event contracts:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../src/lib/db";
import * as auth from "../../src/lib/auth";
import { updateQuizDetailsAction } from "../../src/actions/quizActions";
import { QUIZ_LOCKED_MUTATION_ERROR } from "../../src/lib/quizLock";
import { domainEvents, DomainEvent } from "../../src/lib/events";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("updateQuizDetailsAction", () => {
  let regularUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let adminUser: { id: string; name: string; role: "USER" | "ADMIN" };
  let futureQuiz: any;
  let startedQuiz: any;
  let cancelledQuiz: any;
  let archivedQuiz: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    domainEvents.clear();
    const suffix = `${Date.now()}-${Math.random()}`;

    regularUser = await prisma.member.create({
      data: { name: `EditUser-${suffix}`, role: "USER" },
    });
    adminUser = await prisma.member.create({
      data: { name: `EditAdmin-${suffix}`, role: "ADMIN" },
    });

    const baseStart = new Date(Date.now() + 86400000);
    futureQuiz = await prisma.quiz.create({
      data: {
        title: "Originele Titel",
        startsAt: baseStart,
        location: "Zaal A, Gent",
        organizerEmail: "old@quiz.be",
        entryFee: "€20 / ploeg",
        flyerImageUrl: "/uploads/original.jpg",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
      include: { team: true },
    });

    startedQuiz = await prisma.quiz.create({
      data: {
        title: "Gestarte Quiz",
        startsAt: new Date(Date.now() - 60000),
        location: "Antwerpen",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
    });

    cancelledQuiz = await prisma.quiz.create({
      data: {
        title: "Geannuleerde Quiz",
        startsAt: baseStart,
        status: "CANCELLED",
        location: "Brugge",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
    });

    archivedQuiz = await prisma.quiz.create({
      data: {
        title: "Gearchiveerde Quiz",
        startsAt: baseStart,
        status: "ARCHIVED",
        location: "Leuven",
        createdById: adminUser.id,
        team: { create: { name: "Ploeg", maxTeamSize: 4 } },
      },
    });
  });

  it("rejects unauthenticated callers without modifying the database", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(null);
    const res = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Hacked",
      startsAt: new Date(Date.now() + 172800000),
      location: "Brussel",
      organizerEmail: null,
      entryFee: null,
    });
    expect(res).toEqual({ success: false, error: "Niet ingelogd" });
    const fresh = await prisma.quiz.findUnique({ where: { id: futureQuiz.id } });
    expect(fresh?.title).toBe("Originele Titel");
  });

  it("returns an error when quizId does not exist", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const res = await updateQuizDetailsAction("non-existent-quiz-id", {
      title: "Titel",
      startsAt: new Date(Date.now() + 172800000),
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(res).toEqual({ success: false, error: "Quiz niet gevonden" });
  });

  it("blocks regular USER from editing started, CANCELLED, or ARCHIVED quizzes while allowing ADMIN", async () => {
    for (const locked of [startedQuiz, cancelledQuiz, archivedQuiz]) {
      vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
      const userRes = await updateQuizDetailsAction(locked.id, {
        title: "Geblokkeerde Update",
        startsAt: new Date(Date.now() + 172800000),
        location: "Nieuw",
        organizerEmail: null,
        entryFee: null,
      });
      expect(userRes).toEqual({ success: false, error: QUIZ_LOCKED_MUTATION_ERROR });

      vi.spyOn(auth, "getSessionMember").mockResolvedValue(adminUser as any);
      const adminRes = await updateQuizDetailsAction(locked.id, {
        title: `Admin Fix ${locked.id}`,
        startsAt: new Date(Date.now() + 172800000),
        location: "Herstelde Locatie",
        organizerEmail: "admin@quiz.be",
        entryFee: "€5 / persoon",
      });
      expect(adminRes.success).toBe(true);
    }
  });

  it("allows USER on open future quiz, clears optional fields with null, preserves governance fields, and emits quiz.details_updated", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const emitted: DomainEvent[] = [];
    domainEvents.subscribe("quiz.details_updated", (event) => {
      emitted.push(event);
    });

    const nextStart = new Date(2027, 2, 15, 20, 30);
    const res = await updateQuizDetailsAction(futureQuiz.id, {
      title: "  Aangepaste Titel  ",
      startsAt: nextStart.toISOString(),
      location: "  Zaal B, Gent  ",
      organizerEmail: "",
      entryFee: null,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.quiz.title).toBe("Aangepaste Titel");
      expect(new Date(res.quiz.startsAt).getTime()).toBe(nextStart.getTime());
      expect(res.quiz.location).toBe("Zaal B, Gent");
      expect(res.quiz.organizerEmail).toBeNull();
      expect(res.quiz.entryFee).toBeNull();
    }

    const updated = await prisma.quiz.findUnique({
      where: { id: futureQuiz.id },
      include: { team: true },
    });
    expect(updated?.title).toBe("Aangepaste Titel");
    expect(updated?.startsAt.getTime()).toBe(nextStart.getTime());
    expect(updated?.location).toBe("Zaal B, Gent");
    expect(updated?.organizerEmail).toBeNull();
    expect(updated?.entryFee).toBeNull();
    expect(updated?.flyerImageUrl).toBe("/uploads/original.jpg");
    expect(updated?.status).toBe("OPEN");
    expect(updated?.team?.maxTeamSize).toBe(4);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].quizId).toBe(futureQuiz.id);
  });

  it("rejects empty title/location, invalid/empty/null startsAt, invalid email, and overlong fields", async () => {
    vi.spyOn(auth, "getSessionMember").mockResolvedValue(regularUser as any);
    const validStart = new Date(Date.now() + 172800000);

    const emptyTitle = await updateQuizDetailsAction(futureQuiz.id, {
      title: "   ",
      startsAt: validStart,
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(emptyTitle.success).toBe(false);

    const emptyLocation = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: validStart,
      location: "   ",
      organizerEmail: null,
      entryFee: null,
    });
    expect(emptyLocation.success).toBe(false);

    const nullStart = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: null as unknown as string,
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(nullStart.success).toBe(false);

    const emptyStart = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: "",
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(emptyStart.success).toBe(false);

    const invalidStart = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: "not-a-date",
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(invalidStart.success).toBe(false);

    const badEmail = await updateQuizDetailsAction(futureQuiz.id, {
      title: "Geldige Titel",
      startsAt: validStart,
      location: "Gent",
      organizerEmail: "geen-email",
      entryFee: null,
    });
    expect(badEmail).toEqual({
      success: false,
      error: "Ongeldig e-mailadres voor organisatie",
    });

    const longTitle = await updateQuizDetailsAction(futureQuiz.id, {
      title: "A".repeat(101),
      startsAt: validStart,
      location: "Gent",
      organizerEmail: null,
      entryFee: null,
    });
    expect(longTitle).toEqual({
      success: false,
      error: "Titel mag maximaal 100 tekens bevatten",
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/actions/editQuizDetailsAction.test.ts`
Expected: FAIL because `updateQuizDetailsAction` is not exported from `src/actions/quizActions.ts`.

- [x] **Step 3: Implement `updateQuizDetailsAction` in `src/actions/quizActions.ts`**

Define and export:

- `UpdateQuizMetadataInput`: `{ title: string; startsAt: Date | string; location: string; organizerEmail: string | null; entryFee: string | null }`
- `UpdateQuizDetailsActionResult`: `{ success: true; quiz: { id: string; title: string; startsAt: Date; location: string; organizerEmail: string | null; entryFee: string | null } } | { success: false; error: string }`
- `updateQuizDetailsAction(quizId: string, rawInput: UpdateQuizMetadataInput): Promise<UpdateQuizDetailsActionResult>`:
  Wrap the action body in an outer `try { ... } catch (err: any) { return { success: false, error: err?.message || "Fout bij bijwerken van quizgegevens." }; }`, containing:
  1. `const currentMember = await getSessionMember();` -> if `!currentMember`, return `{ success: false, error: "Niet ingelogd" }`.
  2. `const existingQuiz = await getQuizById(quizId);` -> if `!existingQuiz`, return `{ success: false, error: "Quiz niet gevonden" }`.
  3. `if (isQuizLockedForUser(existingQuiz, currentMember.role))` -> return `{ success: false, error: QUIZ_LOCKED_MUTATION_ERROR }`.
  4. Trim `title = (rawInput.title ?? "").trim()` and `location = (rawInput.location ?? "").trim()`; return `{ success: false, error: "Titel en locatie zijn verplicht." }` if either is empty.
  5. Check `!rawInput.startsAt` -> return `{ success: false, error: "Ongeldige startdatum of -tijd." }`; parse `const startsAt = new Date(rawInput.startsAt)` and reject if `Number.isNaN(startsAt.getTime())`.
  6. Normalize `organizerEmail = rawInput.organizerEmail?.trim() ? rawInput.organizerEmail.trim() : null` and `entryFee = rawInput.entryFee?.trim() ? rawInput.entryFee.trim() : null`.
  7. Validate via `validateQuizFields({ title, location, organizerEmail, entryFee })`; if invalid, return `{ success: false, error: Object.values(validation.errors)[0] }`.
  8. Call `const updated = await updateQuizDetails(quizId, { title, startsAt, location, organizerEmail, entryFee })`.
  9. Revalidate `revalidatePath("/quizzes")` and `revalidatePath(\`/quizzes/${quizId}\`)`inside a dedicated inner`try { ... } catch {}`.
  10. Return `{ success: true, quiz: { id: updated.id, title: updated.title, startsAt: updated.startsAt, location: updated.location, organizerEmail: updated.organizerEmail, entryFee: updated.entryFee } }`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/actions/editQuizDetailsAction.test.ts`
Expected: PASS (all 5 test cases pass against PostgreSQL).

---

### Task 4: `EditQuizDialog` Modal Component

**Files:**

- Create: `src/components/EditQuizDialog.tsx`
- Create: `tests/components/EditQuizDialog.test.tsx`

**Interfaces:**

- Consumes:
  - `QuizMetadataFields` from `@/components/QuizMetadataFields`
  - `formatStructuredEntryFee`, `parseStructuredEntryFee` from `@/services/quizService`
  - `formatEuropeanDate`, `formatEuropeanTime`, `parseEuropeanDateTime` from `@/lib/formatters`
  - `UpdateQuizMetadataInput` from `@/actions/quizActions`
- Produces:
  - `EditableQuizMetadata` and `EditQuizDialogProps` in `src/components/EditQuizDialog.tsx`:
    ```ts
    export interface EditableQuizMetadata {
      title: string;
      startsAt: Date | string;
      location: string;
      organizerEmail: string | null;
      entryFee: string | null;
    }

    export interface EditQuizDialogProps {
      isOpen: boolean;
      quiz: EditableQuizMetadata;
      onClose: () => void;
      onSave: (payload: UpdateQuizMetadataInput) => Promise<void>;
    }
    ```
  - `EditQuizDialog(props: EditQuizDialogProps)` in `src/components/EditQuizDialog.tsx`

- [x] **Step 1: Write the failing component tests in `tests/components/EditQuizDialog.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditQuizDialog } from "../../src/components/EditQuizDialog";

describe("EditQuizDialog", () => {
  const sampleQuiz = {
    title: "Herfstkwis Gent",
    startsAt: new Date(2026, 10, 20, 20, 15),
    location: "Zaal Centrum, Gent",
    organizerEmail: "info@kwis.be",
    entryFee: "€5 / persoon",
  };

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <EditQuizDialog isOpen={false} quiz={sampleQuiz} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(html).toBe("");
  });

  it("renders pre-populated European date/time, metadata, and parsed fee unit when open", () => {
    const html = renderToStaticMarkup(
      <EditQuizDialog isOpen={true} quiz={sampleQuiz} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("Quizgegevens bewerken");
    expect(html).toContain('value="Herfstkwis Gent"');
    expect(html).toContain('value="20/11/2026"');
    expect(html).toContain('value="20:15"');
    expect(html).toContain('value="Zaal Centrum, Gent"');
    expect(html).toContain('value="info@kwis.be"');
    expect(html).toContain('value="5"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>\/ ploeg/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>\/ persoon/);
    expect(html).toContain("Annuleren");
    expect(html).toContain("Opslaan");
  });

  it("handles null optional fields and legacy freeform entryFee safely", () => {
    const html = renderToStaticMarkup(
      <EditQuizDialog
        isOpen={true}
        quiz={{
          title: "Gratis Kwis",
          startsAt: new Date(2026, 11, 5, 19, 30),
          location: "Kaffee De Hoek",
          organizerEmail: null,
          entryFee: "gratis",
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain('value="Gratis Kwis"');
    expect(html).toContain('value="05/12/2026"');
    expect(html).toContain('value="19:30"');
    expect(html).toContain('value=""');
    expect(html).toMatch(/aria-pressed="true"[^>]*>\/ ploeg/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/EditQuizDialog.test.tsx`
Expected: FAIL because `src/components/EditQuizDialog.tsx` does not exist yet.

- [x] **Step 3: Implement `EditQuizDialog` in `src/components/EditQuizDialog.tsx`**

Implement using the wrapper-remount pattern:

- `export function EditQuizDialog(props: EditQuizDialogProps)` returns `null` when `!props.isOpen`, otherwise renders `<EditQuizDialogContent {...props} />`.
- Inside `EditQuizDialogContent`:
  - Initialize state from `props.quiz`: `title`, `date` via `formatEuropeanDate(quiz.startsAt)`, `time` via `formatEuropeanTime(quiz.startsAt)`, `location`, `organizerEmail ?? ""`, `parsedFee = parseStructuredEntryFee(quiz.entryFee)` (`entryFeeAmount`, `entryFeeUnit`), `missingFields = []`, `errorBanner = null`, `isSubmitting = false`.
  - Render `fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs` overlay with scrollable card (`max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl`).
  - Header with `Pencil` icon, `<h3>Quizgegevens bewerken</h3>`, and close `X` button (`disabled={isSubmitting}`, `onClick={onClose}`).
  - Inside `<form onSubmit={handleSubmit}>`: render error banner when `errorBanner` is set, `<QuizMetadataFields ... disabled={isSubmitting} />` (clearing the corresponding field key from `missingFields` inside `onTitleChange`, `onDateChange`, `onTimeChange`, and `onLocationChange`), and footer buttons `Annuleren` (`disabled={isSubmitting}`) and `Opslaan` (`disabled={isSubmitting}`, label `"Opslaan..."` while submitting).
  - In `handleSubmit`:
    1. Validate required fields (`title`, `date`, `time`, `location`); set `missingFields` and `errorBanner` if any are empty.
    2. Validate optional `organizerEmail` against `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` if non-empty.
    3. Parse `parsedDate = parseEuropeanDateTime(date, time)`; if null, set `errorBanner` and return.
    4. Format `entryFee = formatStructuredEntryFee(entryFeeAmount, entryFeeUnit) ?? null`, `normalizedEmail = organizerEmail.trim() || null`.
    5. Run `setIsSubmitting(true)` and `try { await onSave({ title: title.trim(), startsAt: parsedDate, location: location.trim(), organizerEmail: normalizedEmail, entryFee }); onClose(); } catch (err: any) { setErrorBanner(err?.message || "Fout bij opslaan van quizgegevens."); } finally { setIsSubmitting(false); }`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/EditQuizDialog.test.tsx`
Expected: PASS (all 3 test cases pass).

---

### Task 5: `QuizDetailClient` Integration, Documentation Sync & Full Verification Gate

**Files:**

- Modify: `src/components/QuizDetailClient.tsx:1-423`
- Create: `tests/components/QuizDetailEditTrigger.test.tsx`
- Modify: `docs/architecture/roles-and-permissions.md:50-70`
- Modify: `docs/architecture/overview.md:14-25,94-99`
- Modify: `docs/roadmap.md:77-84`

**Interfaces:**

- Consumes:
  - `EditQuizDialog` from `@/components/EditQuizDialog`
  - `updateQuizDetailsAction`, `UpdateQuizMetadataInput` from `@/actions/quizActions`
- Produces:
  - Collaborative `[✏️ Bewerken]` trigger and `quizDetails` single-source-of-truth state in `src/components/QuizDetailClient.tsx`

- [x] **Step 1: Write the failing component tests in `tests/components/QuizDetailEditTrigger.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { CapabilitiesProvider } from "../../src/features/capabilities";

const caps = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: false,
  sharedGoogleCalendar: false,
};

function makeQuiz(overrides: Partial<any> = {}) {
  return {
    id: "quiz-edit-1",
    title: "Zomerquiz",
    startsAt: new Date(Date.now() + 86400000),
    durationMinutes: 180,
    location: "Zaal Centrum",
    organizerEmail: "org@quiz.be",
    entryFee: "€20 / ploeg",
    status: "OPEN",
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [],
    },
    ...overrides,
  };
}

describe("QuizDetailClient Edit Trigger Visibility", () => {
  it("shows Bewerken button for regular USER on an open future quiz", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={caps}>
        <QuizDetailClient quiz={makeQuiz()} currentMemberId="user-1" isAdmin={false} />
      </CapabilitiesProvider>
    );
    expect(html).toContain("Bewerken");
  });

  it("hides Bewerken button for regular USER on started, CANCELLED, or ARCHIVED quizzes", () => {
    for (const locked of [
      makeQuiz({ startsAt: new Date(Date.now() - 60000) }),
      makeQuiz({ status: "CANCELLED" }),
      makeQuiz({ status: "ARCHIVED" }),
    ]) {
      const html = renderToStaticMarkup(
        <CapabilitiesProvider capabilities={caps}>
          <QuizDetailClient quiz={locked} currentMemberId="user-1" isAdmin={false} />
        </CapabilitiesProvider>
      );
      expect(html).not.toContain("Bewerken");
    }
  });

  it("keeps Bewerken button visible for ADMIN on started, CANCELLED, or ARCHIVED quizzes", () => {
    for (const locked of [
      makeQuiz({ startsAt: new Date(Date.now() - 60000) }),
      makeQuiz({ status: "CANCELLED" }),
      makeQuiz({ status: "ARCHIVED" }),
    ]) {
      const html = renderToStaticMarkup(
        <CapabilitiesProvider capabilities={caps}>
          <QuizDetailClient quiz={locked} currentMemberId="admin-1" isAdmin={true} />
        </CapabilitiesProvider>
      );
      expect(html).toContain("Bewerken");
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/QuizDetailEditTrigger.test.tsx`
Expected: FAIL because `Bewerken` button is not yet rendered in `QuizDetailClient.tsx`.

- [x] **Step 3: Integrate `quizDetails` state, `[✏️ Bewerken]` trigger, and `EditQuizDialog` in `src/components/QuizDetailClient.tsx`**

- Import `Pencil` from `lucide-react`, `EditQuizDialog` from `@/components/EditQuizDialog`, and `updateQuizDetailsAction`, `UpdateQuizMetadataInput` from `@/actions/quizActions`.
- Initialize unified single-source-of-truth state:
  ```ts
  const [quizDetails, setQuizDetails] = useState({
    id: quiz.id as string,
    title: quiz.title as string,
    startsAt: quiz.startsAt as Date | string,
    location: quiz.location as string,
    organizerEmail: (quiz.organizerEmail ?? null) as string | null,
    entryFee: (quiz.entryFee ?? null) as string | null,
    flyerImageUrl: (quiz.flyerImageUrl ?? null) as string | null,
    status: (quiz.status ?? "OPEN") as "OPEN" | "CANCELLED" | "ARCHIVED",
    durationMinutes: (quiz.durationMinutes ?? 180) as number,
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  ```
- Derive `isConcluded` (`isQuizConcluded(new Date(quizDetails.startsAt), quizDetails.durationMinutes)`), `isPersonalLocked` (`isPersonalRsvpLocked(quizDetails)`), `isLockedForUser` (`isQuizLockedForUser(quizDetails, isAdmin ? "ADMIN" : "USER")`), and `dateStr` (`formatEuropeanDateTime(quizDetails.startsAt)`) purely from `quizDetails`.
- Update Flyer Banner / Header Card, Meta Details Card, `QuizRatingWidget` props (`isCancelled={quizDetails.status === "CANCELLED"}`), and `ActionToolbar` props (`quizId={quizDetails.id}`, `quizTitle={quizDetails.title}`, `quizDate={new Date(quizDetails.startsAt)}`, `location={quizDetails.location}`, `durationMinutes={quizDetails.durationMinutes}`, `organizerEmail={quizDetails.organizerEmail || undefined}`) to read exclusively from `quizDetails`.
- In the top navigation bar (beside `{isAdmin && <Link href=...Admin</Link>}`) or Meta Details Card header, render when `!isLockedForUser`:
  ```tsx
  {
    !isLockedForUser && (
      <button
        type="button"
        onClick={() => setIsEditDialogOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900"
      >
        <Pencil className="h-3.5 w-3.5" />
        <span>Bewerken</span>
      </button>
    );
  }
  ```
- Implement `handleSaveQuizDetails = async (payload: UpdateQuizMetadataInput) => { const res = await updateQuizDetailsAction(quizDetails.id, payload); if (!res.success) throw new Error(res.error); setQuizDetails((prev) => ({ ...prev, ...res.quiz })); }` and render `<EditQuizDialog isOpen={isEditDialogOpen} quiz={quizDetails} onClose={() => setIsEditDialogOpen(false)} onSave={handleSaveQuizDetails} />`.

- [x] **Step 4: Run all UI and component tests to verify pass**

Run: `npx vitest run tests/components/QuizDetailEditTrigger.test.tsx tests/components/QuizStartLockdownUI.test.tsx tests/components/QuizDetailFlyer.test.tsx tests/ui/quizRatingIntegration.test.tsx`
Expected: PASS across all 4 test files.

- [x] **Step 5: Update documentation (`roles-and-permissions.md`, `overview.md`, `roadmap.md`)**

- In `docs/architecture/roles-and-permissions.md`: add `Edit quiz metadata` (`USER`: `✅ (pre-start)`, `ADMIN`: `✅`, `updateQuizDetailsAction`) to the Permission Matrix under **Quiz Administration** (or **Quiz Browsing & Editing**).
- In `docs/architecture/overview.md`: add `EditQuizDialog` and `QuizMetadataFields` alongside `QuizEntryForm` / `EditQuizClient` in the architecture overview diagram and browser runtime section.
- In `docs/roadmap.md`: update item `#1` status to reflect active plan tracking (`[ ] Plan Ready: [docs/superpowers/plans/2026-11-23-edit-quiz-details.md](superpowers/plans/2026-11-23-edit-quiz-details.md)`).

- [x] **Step 6: Run full repository quality gate (`npm run check:all`)**

Run: `npm run format:write && npm run check:all`
Expected: `typecheck`, `test`, `lint`, `format:check`, `audit:check`, `scan:secrets`, `knip`, and `knip:prod` ALL exit 0 with zero errors or unused export warnings.
