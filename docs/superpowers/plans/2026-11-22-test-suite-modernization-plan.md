# Test Suite Modernization (Path A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Mark each checkbox `- [x]` immediately after completing that step (`AGENTS.md`).

**Goal:** Eliminate brittle `fs.readFileSync` source-scraping UI tests, remove the obsolete Day-1 DB seed smoke test, upgrade the 6 UI tests to `renderToStaticMarkup` (`.test.tsx`), and fix `tests/ui/adminLayout.test.ts` to execute `requireAdminSession` end-to-end via lower-level boundary mocks.

**Architecture:** All test execution remains strictly under Vitest `environment: "node"` using `react-dom/server` (`renderToStaticMarkup`) and `@vitejs/plugin-react` JSX transform (`tsconfig.json` `jsx: "react-jsx"`, `noUnusedLocals: true`). Server-boundary testing in `tests/ui/adminLayout.test.ts` mocks `next/headers` (`cookies`) and `@/lib/db` (`prisma.session`) rather than `@/lib/auth` so intra-module calls (`requireAdminSession` → `getSessionMember` → `validateSession`) execute unmodified.

**Tech Stack:** Vitest 5 (`environment: "node"`), React 19 (`react-dom/server`), TypeScript 6 (`strict: true`, `noUnusedLocals: true`), ESLint 9, Prettier, Knip 6.

**Spec:** `docs/superpowers/specs/2026-11-22-test-suite-modernization-design.md`

## Global Constraints

- Vitest runs in `environment: "node"` (`vitest.config.ts`) — do NOT add `jsdom` or `@testing-library/react`.
- Do NOT modify application source code (`src/`) unless a real bug surfaces.
- Leave the 5 pre-existing uncommitted working-tree changes (`tests/ui/feedbackWidget.test.ts`, `tests/ui/flyerUploader.test.ts`, `tests/ui/memberRoster.test.ts`, `tests/ui/stepper.test.ts`, `tests/unit/knipConfig.test.ts`) untouched; `npm run check:all` validates the combined tree.
- Preserve existing `tests/components/` coverage without introducing duplicate assertions.
- All modified/created files (including markdown docs) must pass `npm run check:all` (`typecheck`, `vitest run`, `eslint`, `prettier`, `audit-ci`, `secretlint`, `knip`, `knip:prod`).
- Never run `git commit` or create git tags without explicit user consent.

## Review Focus

1. **Expired & unknown session cookies on `/admin`:** When `prisma.session.findUnique` returns `null` (unknown token) or a session with `expiresAt < new Date()`, `validateSession` must reject it (and call `prisma.session.delete` for expired sessions), causing `AdminLayout` to render `AdminUnauthorizedDialog` (`"Toegang Gewijzigd"`).
2. **`QuizzesDashboard` populated vs. empty state:** When `initialQuizzes` has at least one quiz, the empty-state CTA (`"Nog geen quizzen gepland"` / `"Eerste Quiz Toevoegen"`) must NOT render.
3. **`ActionToolbar` capability & registration state matrix:** With `emailRegistration: false` and `isRegistered: false`, `"Bevestig registratie"` renders without `"Mail verzonden? Bevestig registratie"`; with `isRegistered: true`, `"✓ Ingeschreven"` and `"Inschrijving heropenen / annuleren"` render.
4. **`AdminFeedbackClient` default `"OPEN"` tab isolation, closed lightbox & missing screenshot:** Resolved items must NOT appear in the initial card list (counted only in `Opgelost`), `"Screenshot bekijken"` must NOT render initially, and items with `screenshot: null` must NOT render an `<img>` element.
5. **No native date/time inputs in `QuizEntryForm` across `vision` modes:** Both `vision: false` and `vision: true` must render `placeholder="DD/MM/JJJJ"` and `placeholder="20:00"` without `type="date"` or `type="time"`.

---

### Task 1: Remove Obsolete DB Seed Smoke Test (`tests/db/schema.test.ts`)

**Files:**

- Delete: `tests/db/schema.test.ts`

- [x] **Step 1: Delete `tests/db/schema.test.ts`**

Remove the Day-1 seed smoke test file (`rm tests/db/schema.test.ts`).

- [x] **Step 2: Verify remaining DB schema tests pass without `schema.test.ts`**

Note: `tests/db/feedbackSchema.test.ts` and `tests/db/ratingSchema.test.ts` connect to the local PostgreSQL test database configured in `vitest.config.ts`.
Run: `npx vitest run tests/db/`
Expected: PASS (`tests/db/feedbackSchema.test.ts` and `tests/db/ratingSchema.test.ts` pass; `tests/db/schema.test.ts` is absent).

---

### Task 2: Convert Dashboard & Admin Navigation UI Tests (`adminNav`, `dashboardHeader`, `emptyDashboard`)

**Files:**

- Create: `tests/ui/adminNav.test.tsx`
- Delete: `tests/ui/adminNav.test.ts`
- Create: `tests/ui/dashboardHeader.test.tsx`
- Delete: `tests/ui/dashboardHeader.test.ts`
- Create: `tests/ui/emptyDashboard.test.tsx`
- Delete: `tests/ui/emptyDashboard.test.ts`

**Interfaces:**

- Consumes: `QuizzesDashboard` from `@/components/QuizzesDashboard` (`{ initialQuizzes, isAdmin?, teamName?, ratingsMap?, initialTab? }`), `CapabilitiesProvider` from `@/features/capabilities`, `ActionToolbar` from `@/components/ActionToolbar`.

- [x] **Step 1: Create `tests/ui/adminNav.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

describe("Admin Navigation Header", () => {
  it("renders Beheer link to /admin in QuizzesDashboard when isAdmin is true", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} isAdmin={true} />);

    expect(html).toContain('href="/admin"');
    expect(html).toContain("Beheer");
  });

  it("omits Beheer link to /admin in QuizzesDashboard when isAdmin is false or omitted", () => {
    const htmlExplicit = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={[]} isAdmin={false} />
    );
    const htmlDefault = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} />);

    expect(htmlExplicit).not.toContain('href="/admin"');
    expect(htmlExplicit).not.toContain("Beheer");
    expect(htmlDefault).not.toContain('href="/admin"');
    expect(htmlDefault).not.toContain("Beheer");
  });
});
```

- [x] **Step 2: Create `tests/ui/dashboardHeader.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";
import { CapabilitiesProvider } from "@/features/capabilities";
import { ActionToolbar } from "@/components/ActionToolbar";

const disabledCapabilities = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: false,
  sharedGoogleCalendar: false,
};

describe("Dashboard Header & Currency Symbols", () => {
  it("renders a logout link to /auth/logout in QuizzesDashboard", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} />);

    expect(html).toContain('href="/auth/logout"');
  });

  it("renders Euro glyph (€) and no Dollar sign ($) in ActionToolbar", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={disabledCapabilities}>
        <ActionToolbar
          quizTitle="De Grote Kwis"
          quizDate={new Date("2026-12-01T20:00:00Z")}
          isRegistered={false}
          isPaid={false}
          teamName="Onze Quizploeg"
          onRegisterToggle={vi.fn()}
          onPaymentToggle={vi.fn()}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("€");
    expect(html).not.toContain("$");
  });
});
```

- [x] **Step 3: Create `tests/ui/emptyDashboard.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

describe("Empty Dashboard State", () => {
  it("renders the empty state CTA linking to /quizzes/new when initialQuizzes is empty", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} />);

    expect(html).toContain("Nog geen quizzen gepland");
    expect(html).toContain("Eerste Quiz Toevoegen");
    expect(html).toContain('href="/quizzes/new"');
  });

  it("omits the empty state CTA when initialQuizzes contains a quiz", () => {
    const html = renderToStaticMarkup(
      <QuizzesDashboard
        initialQuizzes={[
          {
            id: "quiz-1",
            title: "Herfstquiz",
            startsAt: new Date(Date.now() + 86_400_000),
            location: "Gent",
            status: "OPEN",
            team: {
              name: "Onze Quizploeg",
              maxTeamSize: 4,
              registeredAt: null,
              paidAt: null,
              rsvps: [],
            },
          },
        ]}
      />
    );

    expect(html).not.toContain("Nog geen quizzen gepland");
    expect(html).not.toContain("Eerste Quiz Toevoegen");
    expect(html).toContain("Herfstquiz");
  });
});
```

- [x] **Step 4: Delete old source-scraping `.test.ts` files**

Remove `tests/ui/adminNav.test.ts`, `tests/ui/dashboardHeader.test.ts`, and `tests/ui/emptyDashboard.test.ts`.

- [x] **Step 5: Run the 3 converted UI test suites**

Run: `npx vitest run tests/ui/adminNav.test.tsx tests/ui/dashboardHeader.test.tsx tests/ui/emptyDashboard.test.tsx`
Expected: PASS (6/6 tests passing).

---

### Task 3: Convert Form Date Inputs, ActionToolbar Registration & AdminFeedbackView Tests

**Files:**

- Create: `tests/ui/formDateInputs.test.tsx`
- Delete: `tests/ui/formDateInputs.test.ts`
- Create: `tests/ui/actionToolbarRegistration.test.tsx`
- Delete: `tests/ui/actionToolbarRegistration.test.ts`
- Create: `tests/ui/adminFeedbackView.test.tsx`
- Delete: `tests/ui/adminFeedbackView.test.ts`

**Interfaces:**

- Consumes: `QuizEntryForm` from `@/components/QuizEntryForm` (`{ currentMemberId }`), `ActionToolbar` from `@/components/ActionToolbar`, `AdminFeedbackClient` & `FeedbackItem` from `@/components/AdminFeedbackClient`, `CapabilitiesProvider` from `@/features/capabilities`.

- [x] **Step 1: Create `tests/ui/formDateInputs.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider } from "@/features/capabilities";
import { QuizEntryForm } from "@/components/QuizEntryForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const baseCaps = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: false,
  sharedGoogleCalendar: false,
};

describe("QuizEntryForm European Date and Time Inputs", () => {
  it.each([false, true])(
    "renders text inputs with European placeholders (DD/MM/JJJJ, 20:00) and no native date/time inputs (vision=%s)",
    (vision) => {
      const html = renderToStaticMarkup(
        <CapabilitiesProvider capabilities={{ ...baseCaps, vision }}>
          <QuizEntryForm currentMemberId="member-1" />
        </CapabilitiesProvider>
      );

      expect(html).not.toContain('type="date"');
      expect(html).not.toContain('type="time"');
      expect(html).toContain('placeholder="DD/MM/JJJJ"');
      expect(html).toContain('placeholder="20:00"');
    }
  );
});
```

- [x] **Step 2: Create `tests/ui/actionToolbarRegistration.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider } from "@/features/capabilities";
import { ActionToolbar } from "@/components/ActionToolbar";

const baseCapabilities = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: true,
  sharedGoogleCalendar: false,
};

const baseProps = {
  quizId: "quiz-1",
  quizTitle: "Voorjaarsquiz",
  quizDate: new Date("2026-12-10T20:00:00Z"),
  organizerEmail: "quiz@example.com",
  isPaid: false,
  teamName: "Onze Quizploeg",
  onRegisterToggle: vi.fn(),
  onPaymentToggle: vi.fn(),
};

describe("ActionToolbar - Decoupled Registration", () => {
  it("renders decoupled email confirmation control and open badge when unregistered with emailRegistration enabled", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={baseCapabilities}>
        <ActionToolbar {...baseProps} isRegistered={false} />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Nog open");
    expect(html).toContain("Mail verzonden? Bevestig registratie");
    expect(html).not.toContain("Inschrijving heropenen / annuleren");
  });

  it("renders direct confirmation label without email prompt when emailRegistration is disabled", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={{ ...baseCapabilities, emailRegistration: false }}>
        <ActionToolbar {...baseProps} isRegistered={false} />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Bevestig registratie");
    expect(html).not.toContain("Mail verzonden? Bevestig registratie");
  });

  it("renders registered badge and cancel/reopen button when isRegistered is true", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={baseCapabilities}>
        <ActionToolbar {...baseProps} isRegistered={true} />
      </CapabilitiesProvider>
    );

    expect(html).toContain("✓ Ingeschreven");
    expect(html).toContain("Inschrijving heropenen / annuleren");
    expect(html).not.toContain("Mail verzonden? Bevestig registratie");
  });
});
```

- [x] **Step 3: Create `tests/ui/adminFeedbackView.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminFeedbackClient, FeedbackItem } from "@/components/AdminFeedbackClient";

const sampleFeedbacks: FeedbackItem[] = [
  {
    id: "fb-open-with-shot",
    category: "BUG",
    message: "Knop overlapt op mobiel",
    pageUrl: "/quizzes/1",
    userAgent: "Mozilla/5.0",
    screenshot: "/uploads/feedback-1.png",
    isResolved: false,
    resolvedAt: null,
    createdAt: new Date("2026-11-20T18:30:00Z"),
    member: { id: "m-1", name: "Marc" },
  },
  {
    id: "fb-open-no-shot",
    category: "IDEA",
    message: "Dark mode toevoegen",
    pageUrl: "/quizzes",
    screenshot: null,
    isResolved: false,
    resolvedAt: null,
    createdAt: new Date("2026-11-21T10:00:00Z"),
    member: { id: "m-2", name: "An" },
  },
  {
    id: "fb-resolved",
    category: "QUESTION",
    message: "Opgeloste vraag over puntentelling",
    pageUrl: "/admin",
    screenshot: "/uploads/feedback-resolved.png",
    isResolved: true,
    resolvedAt: new Date("2026-11-21T12:00:00Z"),
    createdAt: new Date("2026-11-19T09:00:00Z"),
    member: { id: "m-3", name: "Piet" },
  },
];

describe("AdminFeedbackClient Render & Filtering", () => {
  it("renders open items in the default OPEN tab, shows accurate tab counts, and omits resolved items from the initial list", () => {
    const html = renderToStaticMarkup(<AdminFeedbackClient initialFeedbacks={sampleFeedbacks} />);

    expect(html).toContain("Knop overlapt op mobiel");
    expect(html).toContain("Dark mode toevoegen");
    expect(html).not.toContain("Opgeloste vraag over puntentelling");

    expect(html).toContain("Openstaand");
    expect(html).toContain(">2<");
    expect(html).toContain("Opgelost");
    expect(html).toContain("(1)");
    expect(html).toContain("Alle (3)");
  });

  it("renders a clickable screenshot thumbnail only when an item has a screenshot and keeps lightbox closed initially", () => {
    const htmlWithShot = renderToStaticMarkup(
      <AdminFeedbackClient initialFeedbacks={[sampleFeedbacks[0]]} />
    );
    const htmlWithoutShot = renderToStaticMarkup(
      <AdminFeedbackClient initialFeedbacks={[sampleFeedbacks[1]]} />
    );

    expect(htmlWithShot).toContain('alt="Screenshot voor fb-open-with-shot"');
    expect(htmlWithShot).toContain('src="/uploads/feedback-1.png"');
    expect(htmlWithShot).not.toContain("Screenshot bekijken");
    expect(htmlWithoutShot).not.toContain("<img");
  });
});
```

- [x] **Step 4: Delete old source-scraping `.test.ts` files**

Remove `tests/ui/formDateInputs.test.ts`, `tests/ui/actionToolbarRegistration.test.ts`, and `tests/ui/adminFeedbackView.test.ts`.

- [x] **Step 5: Run the 3 converted UI test suites**

Run: `npx vitest run tests/ui/formDateInputs.test.tsx tests/ui/actionToolbarRegistration.test.tsx tests/ui/adminFeedbackView.test.tsx`
Expected: PASS (7/7 test cases passing — 2 parameterized `it.each` + 3 + 2).

---

### Task 4: Fix `tests/ui/adminLayout.test.ts` via Lower-Level Boundary Mocks

**Files:**

- Modify: `tests/ui/adminLayout.test.ts`

**Interfaces:**

- Exercises: `AdminLayout` (`src/app/admin/layout.tsx`) → `requireAdminSession` (`src/lib/auth.ts`) → `getSessionMember` → `validateSession` → `AdminUnauthorizedDialog` (`"Toegang Gewijzigd"`).
- Mocks: `cookies` from `"next/headers"` and `prisma.session.{findUnique,update,delete}` from `"@/lib/db"`.

- [x] **Step 1: Replace `tests/ui/adminLayout.test.ts` with lower-level boundary mocks**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import AdminLayout from "@/app/admin/layout";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("AdminLayout Access Guard", () => {
  beforeEach(() => {
    // Use clearAllMocks (not resetAllMocks) to preserve update/delete resolved promises
    // so validateSession's `.catch(() => {})` never throws and gets swallowed by getSessionMember.
    vi.clearAllMocks();
  });

  it("renders AdminUnauthorizedDialog when session cookie is missing", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("renders AdminUnauthorizedDialog when session cookie token is unknown", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "unknown-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("unknown-token") },
      include: { member: true },
    });
    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("deletes expired session and renders AdminUnauthorizedDialog", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "expired-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "sess-expired",
      expiresAt: new Date(Date.now() - 60_000),
      member: { id: "admin-1", name: "Marc", role: "ADMIN" },
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: "sess-expired" } });
    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("renders AdminUnauthorizedDialog when user has role USER", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "raw-user-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "sess-user",
      expiresAt: new Date(Date.now() + 60_000),
      member: { id: "user-1", name: "Regular", role: "USER" },
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("raw-user-token") },
      include: { member: true },
    });
    expect(prisma.session.update).toHaveBeenCalledTimes(1);
    expect(html).toContain("Toegang Gewijzigd");
    expect(html).not.toContain("Protected Admin Content");
  });

  it("renders children when user has role ADMIN", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "session_token", value: "raw-admin-token" }),
    } as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "sess-admin",
      expiresAt: new Date(Date.now() + 60_000),
      member: { id: "admin-1", name: "Marc", role: "ADMIN" },
    } as any);

    const element = await AdminLayout({
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    const html = renderToStaticMarkup(element);

    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("raw-admin-token") },
      include: { member: true },
    });
    expect(prisma.session.update).toHaveBeenCalledTimes(1);
    expect(html).toContain("Protected Admin Content");
    expect(html).not.toContain("Toegang Gewijzigd");
  });
});
```

- [x] **Step 2: Run `tests/ui/adminLayout.test.ts`**

Run: `npx vitest run tests/ui/adminLayout.test.ts`
Expected: PASS (5/5 tests passing, executing `AdminLayout` → `requireAdminSession` → `getSessionMember` → `validateSession` end-to-end).

---

### Task 5: Spec Status Sync, Formatting, Release Closeout & Full Quality Gate

**Files:**

- Modify: `docs/superpowers/specs/2026-11-22-test-suite-modernization-design.md`

- [x] **Step 1: Update spec status in `docs/superpowers/specs/2026-11-22-test-suite-modernization-design.md`**

Change `**Status:** Draft — Pending Approval` to `**Status:** Implemented`.

- [x] **Step 2: Run Prettier write on modified markdown/test files**

Run: `npx prettier --write AGENTS.md docs/superpowers/specs/2026-11-22-test-suite-modernization-design.md docs/superpowers/plans/2026-11-22-test-suite-modernization-plan.md tests/ui/`
Expected: Exits `0` cleanly.

- [x] **Step 3: Run `documenting-feature-release` check & full verification gate (`npm run check:all`)**

Invoke `documenting-feature-release` to confirm doc/changelog/roadmap sync status (noting no `src/`, schema, API, or `.env.example` changes; do NOT commit or create git tags without explicit user consent).
Run: `npm run check:all`
Expected: Exit `0` across `typecheck`, `vitest run`, `eslint .`, `prettier --check .`, `audit-ci`, `secretlint`, `knip`, and `knip:prod`.

- [x] **Step 4: Dispatch fresh-context `general` subagent for final implementation review**

Verify all modified/created files, deleted files, `git status`, and `npm run check:all` output via an independent fresh-context subagent before reporting completion.
