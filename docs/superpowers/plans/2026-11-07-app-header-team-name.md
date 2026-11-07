# App Header Team Name Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the main app header (`QuizzesDashboard.tsx`) to dynamically display the configured team name from `TeamSetting` instead of the hardcoded `"KwisVrienden"`, and update `prisma/seed.ts` to initialize `TeamSetting` with the neutral default `"Onze Quizploeg"` instead of `"Ben in Black"`.

**Architecture:** Add a service function `getDefaultTeamName()` to `src/services/quizService.ts` to encapsulate database access for `TeamSetting` with a `"KwisVrienden"` fallback. Fetch this in `src/app/quizzes/page.tsx` and pass `teamName` to `QuizzesDashboard`. Update `QuizzesDashboard` to render the dynamic team name in the header, backed by server-side static markup unit tests in Vitest. Update `prisma/seed.ts` and `prisma/schema.prisma` defaults to `"Onze Quizploeg"`.

**Tech Stack:** Next.js Server Components, Prisma, React, Vitest (`react-dom/server`).

**Spec:** Documented in `docs/roadmap.md` (Part 1, Item #9).

## Global Constraints

- **No Schema Migrations:** Pure presentation and service query refactoring; database models remain untouched.
- **Strict Single Source of Truth:** `TeamSetting` singleton (`id: "singleton"`) remains the authority for default team name.
- **Safe Fallback:** If `TeamSetting` does not exist in the database, fall back cleanly to `"KwisVrienden"`.
- **Pure Node-based Tests:** Use `react-dom/server` / `renderToStaticMarkup` without unconfigured browser DOM dependencies.

## Review Focus

1. **Missing / Null Settings Record:** `getDefaultTeamName()` returns `"KwisVrienden"` if `TeamSetting` is not found or empty.
2. **Custom Configured Team Name:** `QuizzesDashboard` renders the custom team name (e.g. `"Onze Quizploeg"`) in its `h1` header when provided.
3. **Empty String or Whitespace Override:** If `teamName` prop is empty whitespace or undefined, `QuizzesDashboard` falls back to `"KwisVrienden"`.
4. **Sub-caption Consistency:** Ensure sub-caption `"Jullie kwisagenda"` remains intact under the header.
5. **No Visual Layout Regressions:** Dashboard layout classes (`flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white`) remain unchanged.

---

### Task 1: Add `getDefaultTeamName()` Service Function

**Files:**

- Modify: `src/services/quizService.ts`
- Test: `tests/services/defaultTeamName.test.ts`

**Interfaces:**

- Consumes: `prisma.teamSetting.findUnique({ where: { id: "singleton" } })`
- Produces: `getDefaultTeamName(): Promise<string>`

- [x] **Step 1: Write the failing unit test for `getDefaultTeamName`**

Create `tests/services/defaultTeamName.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDefaultTeamName } from "@/services/quizService";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    teamSetting: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getDefaultTeamName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns configured team name when TeamSetting exists", async () => {
    (prisma.teamSetting.findUnique as any).mockResolvedValue({
      id: "singleton",
      defaultTeamName: "Ben in Black",
    });

    const result = await getDefaultTeamName();
    expect(result).toBe("Ben in Black");
  });

  it("falls back to 'KwisVrienden' when TeamSetting record is null", async () => {
    (prisma.teamSetting.findUnique as any).mockResolvedValue(null);

    const result = await getDefaultTeamName();
    expect(result).toBe("KwisVrienden");
  });

  it("falls back to 'KwisVrienden' when defaultTeamName is blank or whitespace", async () => {
    (prisma.teamSetting.findUnique as any).mockResolvedValue({
      id: "singleton",
      defaultTeamName: "   ",
    });

    const result = await getDefaultTeamName();
    expect(result).toBe("KwisVrienden");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test tests/services/defaultTeamName.test.ts`
Expected: FAIL with "getDefaultTeamName is not a function"

- [x] **Step 3: Implement `getDefaultTeamName()` in `src/services/quizService.ts`**

Export `getDefaultTeamName`:

```typescript
export async function getDefaultTeamName(): Promise<string> {
  const settings = await prisma.teamSetting.findUnique({
    where: { id: "singleton" },
  });
  const name = settings?.defaultTeamName?.trim();
  return name && name.length > 0 ? name : "KwisVrienden";
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test tests/services/defaultTeamName.test.ts`
Expected: PASS

---

### Task 2: Update `QuizzesDashboard` Header & Component Tests

**Files:**

- Modify: `src/components/QuizzesDashboard.tsx`
- Create: `tests/components/QuizzesDashboardHeader.test.tsx`

**Interfaces:**

- Consumes: `teamName?: string` prop in `QuizzesDashboardProps`
- Produces: Dynamic header display in `<h1 className="text-lg leading-none font-bold text-slate-900">`

- [x] **Step 1: Write the failing component test**

Create `tests/components/QuizzesDashboardHeader.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

describe("QuizzesDashboard Header Branding", () => {
  it("renders custom teamName in header when provided", () => {
    const html = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={[]} teamName="Onze Quizploeg" />
    );
    expect(html).toContain("Onze Quizploeg");
    expect(html).not.toContain("KwisVrienden");
    expect(html).toContain("Jullie kwisagenda");
  });

  it("falls back to 'KwisVrienden' when teamName is undefined", () => {
    const html = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={[]} />
    );
    expect(html).toContain("KwisVrienden");
  });

  it("falls back to 'KwisVrienden' when teamName is empty or whitespace", () => {
    const html = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={[]} teamName="   " />
    );
    expect(html).toContain("KwisVrienden");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/QuizzesDashboardHeader.test.tsx`
Expected: FAIL (renders "KwisVrienden" instead of "Onze Quizploeg")

- [x] **Step 3: Update `QuizzesDashboard.tsx`**

1. Add `teamName?: string` to `QuizzesDashboardProps`.
2. In `QuizzesDashboard`:

```typescript
const resolvedTeamName = teamName?.trim() ? teamName.trim() : "KwisVrienden";
```

3. Update header line:

```tsx
<h1 className="text-lg leading-none font-bold text-slate-900">{resolvedTeamName}</h1>
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/QuizzesDashboardHeader.test.tsx`
Expected: PASS

---

### Task 3: Wire `getDefaultTeamName()` in `src/app/quizzes/page.tsx` & End-to-End Verification

**Files:**

- Modify: `src/app/quizzes/page.tsx`

**Interfaces:**

- Consumes: `getDefaultTeamName()` from `@/services/quizService`
- Produces: `<QuizzesDashboard initialQuizzes={quizzes} isAdmin={...} teamName={defaultTeamName} />`

- [x] **Step 1: Update `src/app/quizzes/page.tsx`**

Import `getDefaultTeamName` from `@/services/quizService`. Fetch `const [quizzes, defaultTeamName] = await Promise.all([getAllQuizzes(), getDefaultTeamName()]);` and pass `teamName={defaultTeamName}` to `<QuizzesDashboard>`.

- [x] **Step 2: Run full test suite and build verification**

Run:

```bash
npm test
npm run build
```

Expected: All tests PASS and build succeeds without TypeScript or bundling errors.

---

### Task 4: Update Seed and Default Fallbacks to "Onze Quizploeg"

**Files:**

- Modify: `prisma/seed.ts`
- Modify: `prisma/schema.prisma`
- Modify: `src/components/QuizzesDashboard.tsx` (fallback on line 106)
- Modify: `src/app/admin/page.tsx` (fallback on line 120)
- Modify: `tests/ui/emptyDashboard.test.ts`

**Interfaces:**

- Produces: Initial database state and clean fallbacks seeded with `"Onze Quizploeg"`.

- [x] **Step 1: Write test assertion for seed team name in `tests/ui/emptyDashboard.test.ts`**

Update `tests/ui/emptyDashboard.test.ts` to expect `"Onze Quizploeg"` in `prisma/seed.ts`:

```typescript
expect(seed).toContain("Onze Quizploeg");
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test tests/ui/emptyDashboard.test.ts`
Expected: FAIL (seed contains "Ben in Black")

- [x] **Step 3: Update `prisma/seed.ts`, `prisma/schema.prisma`, and fallback references**

1. In `prisma/seed.ts`, update `defaultTeamName` upsert to `"Onze Quizploeg"`.
2. In `prisma/schema.prisma`, update `TeamSetting.defaultTeamName` `@default("Onze Quizploeg")`.
3. In `src/components/QuizzesDashboard.tsx` and `src/app/admin/page.tsx`, update remaining fallback literals from `"Ben in Black"` to `"Onze Quizploeg"`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test tests/ui/emptyDashboard.test.ts`
Expected: PASS
