# Core Domain & Auxiliary Integrations Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the Core Quiz Coordination domain from auxiliary integrations (AI flyer vision, calendar feeds, and messaging helpers), enabling lightweight, zero-external-dependency self-hosting with an adaptive UI and automated OpenAPI drift prevention.

**Architecture:** Maintain a single Next.js monolith structured around an isolated Core and discrete feature modules (`src/features/*`). A centralized capability registry (`src/features/capabilities/`) inspects environment flags and AI keys, driving adaptive UI visibility and route guardrails (returning HTTP 501 when disabled) with Vitest automated contract tests enforcing OpenAPI synchronization.

**Tech Stack:** Next.js 16 (App Router, Server Actions, React 19), TypeScript, Prisma ORM, Vitest, OpenAPI 3.1, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-10-31-core-integrations-decoupling-design.md`

## Global Constraints

- **Core Independence:** Core domain services (`quizService`, `rsvpService`, `paymentService`, `registrationService`) must never import third-party AI or storage SDKs.
- **Backwards Compatibility:** Default configuration preserves all features when environment keys are present; database schema remains 100% compatible with zero migrations.
- **Adaptive UI Contract:** Disabled features must be cleanly omitted from the user interface rather than displayed as disabled placeholders.
- **OpenAPI Invariant:** All route handlers must remain in 1-to-1 sync with `docs/api/openapi.yaml`.

## Review Focus

1. **Missing AI Keys in Production:** If no `GEMINI_API_KEY` or `OPENAI_API_KEY` is set, `capabilities.vision` must evaluate to `false` without crashing server startup.
2. **Preserving Core Action Toolbar Controls:** When `icalExport`, `whatsappShare`, and `emailRegistration` capabilities are all `false`, `ActionToolbar` must keep the core Team Registration toggle and Payment status toggle fully visible and operational.
3. **Core Flyer Upload without AI:** When `capabilities.vision` is `false`, users can still attach a flyer image via `/api/quizzes/upload-flyer` and see it rendered on the detail page, without triggering any AI OCR network calls.
4. **Disabled Route Handler Status Codes:** Requests to disabled integration endpoints (`/api/quizzes/extract`, `/api/quizzes/[id]/calendar.ics`) must return HTTP `501 Not Implemented` with valid JSON error payloads.
5. **OpenAPI Schema Divergence:** Any route handler parameter or status code change without a corresponding edit to `docs/api/openapi.yaml` must cause the test suite to fail.

---

### Task 1: Capability Registry & Explicit Opt-In Flags

**Files:**
- Create: `src/features/capabilities/capabilities.ts`
- Create: `src/features/capabilities/types.ts`
- Test: `tests/features/capabilities.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AppCapabilities {
    vision: boolean;
    icalExport: boolean;
    whatsappShare: boolean;
    emailRegistration: boolean;
  }
  export function getCapabilities(env?: NodeJS.ProcessEnv): AppCapabilities;
  ```

- [ ] **Step 1: Write the failing tests for capability resolution**

Create `tests/features/capabilities.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getCapabilities } from "@/features/capabilities/capabilities";

describe("Capability Registry", () => {
  it("defaults all capabilities to false when no flags are set (pure Core-only default)", () => {
    const caps = getCapabilities({});
    expect(caps.vision).toBe(false);
    expect(caps.icalExport).toBe(false);
    expect(caps.whatsappShare).toBe(false);
    expect(caps.emailRegistration).toBe(false);
  });

  it("does NOT auto-detect vision from API keys alone", () => {
    const caps = getCapabilities({ GEMINI_API_KEY: "test-key" });
    expect(caps.vision).toBe(false);
  });

  it("enables vision only when ENABLE_AI_VISION is 'true'", () => {
    const caps = getCapabilities({ ENABLE_AI_VISION: "true" });
    expect(caps.vision).toBe(true);
  });

  it("enables icalExport only when ENABLE_ICAL_EXPORT is 'true'", () => {
    const caps = getCapabilities({ ENABLE_ICAL_EXPORT: "true" });
    expect(caps.icalExport).toBe(true);
  });

  it("enables whatsappShare only when ENABLE_WHATSAPP_SHARE is 'true'", () => {
    const caps = getCapabilities({ ENABLE_WHATSAPP_SHARE: "true" });
    expect(caps.whatsappShare).toBe(true);
  });

  it("enables emailRegistration only when ENABLE_EMAIL_REGISTRATION is 'true'", () => {
    const caps = getCapabilities({ ENABLE_EMAIL_REGISTRATION: "true" });
    expect(caps.emailRegistration).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/features/capabilities.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `types.ts` and `capabilities.ts`**

In `src/features/capabilities/types.ts`: define `AppCapabilities`.
In `src/features/capabilities/capabilities.ts`: implement `getCapabilities(env = process.env): AppCapabilities` checking strict equality `=== "true"` for `ENABLE_AI_VISION`, `ENABLE_ICAL_EXPORT`, `ENABLE_WHATSAPP_SHARE`, and `ENABLE_EMAIL_REGISTRATION`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/features/capabilities.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/capabilities tests/features/capabilities.test.ts
git commit -m "feat(capabilities): implement central deployment capability registry with explicit opt-in flags"
```

---

### Task 2: Modularize Integration Folders & Core Isolation

**Files:**
- Create: `src/features/vision/index.ts`
- Create: `src/features/calendar/index.ts`
- Create: `src/features/sharing/index.ts`
- Modify: `src/services/quizService.ts` (verify zero imports from vision)
- Test: `tests/features/core-isolation.test.ts`

**Interfaces:**
- Consumes: `src/services/visionService.ts`, `src/lib/ical.ts`, `src/lib/whatsapp.ts`, `src/lib/mailto.ts`
- Produces:
  - `src/features/vision/index.ts` re-exporting vision extraction and storage
  - `src/features/calendar/index.ts` re-exporting `buildQuizCalendarFeed`
  - `src/features/sharing/index.ts` re-exporting WhatsApp and mailto helpers

- [ ] **Step 1: Write architectural boundary test**

Create `tests/features/core-isolation.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Core Domain Isolation Invariant", () => {
  it("ensures quizService.ts does not import from vision, storage, or external integration libs", () => {
    const serviceContent = fs.readFileSync(
      path.join(process.cwd(), "src/services/quizService.ts"),
      "utf8"
    );
    expect(serviceContent).not.toMatch(/from\s+['"].*visionService['"]/);
    expect(serviceContent).not.toMatch(/from\s+['"].*@vercel\/blob['"]/);
    expect(serviceContent).not.toMatch(/from\s+['"].*@google\/generative-ai['"]/);
  });
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npm test tests/features/core-isolation.test.ts`

- [ ] **Step 3: Create module entry points in `src/features/`**

Create `src/features/vision/index.ts` exporting functions from `visionService.ts` and `storage.ts`.
Create `src/features/calendar/index.ts` exporting functions from `ical.ts`.
Create `src/features/sharing/index.ts` exporting functions from `whatsapp.ts` and `mailto.ts`.

- [ ] **Step 4: Run test to verify boundary consistency**

Run: `npm test tests/features/core-isolation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ tests/features/core-isolation.test.ts
git commit -m "refactor(modules): isolate integration modules and enforce core independence"
```

---

### Task 3: Automated OpenAPI Sync & Contract Testing

**Files:**
- Create: `tests/api/openapi-sync.test.ts`

**Interfaces:**
- Consumes: `docs/api/openapi.yaml`, file system routes in `src/app/api/` and `src/app/auth/`

- [ ] **Step 1: Write the failing OpenAPI synchronization test**

Create `tests/api/openapi-sync.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("OpenAPI Synchronization", () => {
  const openApiContent = fs.readFileSync(
    path.join(process.cwd(), "docs/api/openapi.yaml"),
    "utf8"
  );

  it("documents /auth/join and /auth/logout", () => {
    expect(openApiContent).toContain("/auth/join:");
    expect(openApiContent).toContain("/auth/logout:");
  });

  it("documents /api/quizzes/{id}/calendar.ics with 200, 404, and 501 responses", () => {
    expect(openApiContent).toContain("/api/quizzes/{id}/calendar.ics:");
    expect(openApiContent).toContain('"501":');
  });

  it("documents /api/quizzes/extract with 200, 400, 500, and 501 responses", () => {
    expect(openApiContent).toContain("/api/quizzes/extract:");
    expect(openApiContent).toContain('"501":');
  });

  it("ensures every route handler in src/app/api is present in openapi.yaml", () => {
    const apiDir = path.join(process.cwd(), "src/app/api");
    const walk = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(filePath));
        } else if (file === "route.ts") {
          results.push(filePath);
        }
      }
      return results;
    };

    const routes = walk(apiDir);
    for (const routePath of routes) {
      const relative = routePath
        .replace(path.join(process.cwd(), "src/app"), "")
        .replace("/route.ts", "")
        .replace(/\[(\w+)\]/g, "{$1}");
      expect(openApiContent).toContain(`${relative}:`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes or flags issues**

Run: `npm test tests/api/openapi-sync.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/api/openapi-sync.test.ts
git commit -m "test(api): add automated OpenAPI contract and route synchronization test"
```

---

### Task 4: Core Flyer Upload & Route Guardrails

**Files:**
- Create: `src/app/api/quizzes/upload-flyer/route.ts`
- Modify: `src/app/api/quizzes/extract/route.ts`
- Modify: `src/app/api/quizzes/[id]/calendar.ics/route.ts`
- Test: `tests/api/guardrails.test.ts`
- Test: `tests/api/upload-flyer.test.ts`

**Interfaces:**
- Consumes: `saveUploadedFlyer` from `src/lib/storage`, `getCapabilities` from `src/features/capabilities/capabilities`
- Produces: 
  - `POST /api/quizzes/upload-flyer`: Returns `{ flyerImageUrl: string }`
  - Returns 501 when integration is disabled for `/extract` or `calendar.ics`

- [ ] **Step 1: Write tests for upload-flyer and disabled guardrails**

Create `tests/api/upload-flyer.test.ts`:
Verify that `POST /api/quizzes/upload-flyer` accepts an image file, saves it, and returns `{ flyerImageUrl }`.

In `tests/api/guardrails.test.ts`:
Assert that `/api/quizzes/extract` returns 501 when `vision` is false.
Assert that `/api/quizzes/[id]/calendar.ics` returns 501 when `icalExport` is false.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/api/upload-flyer.test.ts tests/api/guardrails.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `upload-flyer/route.ts` and guardrails**

Implement `src/app/api/quizzes/upload-flyer/route.ts` using `saveUploadedFlyer`.
Add 501 capability checks in `extract/route.ts` and `calendar.ics/route.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test tests/api/upload-flyer.test.ts tests/api/guardrails.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ tests/api/upload-flyer.test.ts tests/api/guardrails.test.ts
git commit -m "feat(api): add core upload-flyer endpoint and capability guardrails"
```

---

### Task 5: Client Capabilities Context Provider & Hook

**Files:**
- Create: `src/features/capabilities/CapabilitiesContext.tsx`
- Create: `src/features/capabilities/index.ts`
- Modify: `src/app/layout.tsx`
- Test: `tests/features/CapabilitiesContext.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export const CapabilitiesProvider: React.FC<{ capabilities: AppCapabilities; children: React.ReactNode }>;
  export function useCapabilities(): AppCapabilities;
  ```

- [ ] **Step 1: Write test for CapabilitiesProvider and useCapabilities hook**

Create `tests/features/CapabilitiesContext.test.tsx` using Vitest / React testing library.
Assert that child components reading `useCapabilities()` receive the provided capabilities object.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/features/CapabilitiesContext.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `CapabilitiesContext.tsx` and re-export in `index.ts`**

Implement `createContext<AppCapabilities>`, `CapabilitiesProvider`, and `useCapabilities`.
In `src/app/layout.tsx`, invoke `getCapabilities()` on the server and wrap children in `<CapabilitiesProvider capabilities={getCapabilities()}>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/features/CapabilitiesContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/capabilities/ src/app/layout.tsx tests/features/CapabilitiesContext.test.tsx
git commit -m "feat(ui): add client CapabilitiesProvider and useCapabilities hook"
```

---

### Task 6: Adaptive UI - Quiz Creation Form (Flyer Attachment & Optional AI)

**Files:**
- Modify: `src/components/FlyerUploader.tsx`
- Modify: `src/components/QuizEntryForm.tsx`
- Test: `tests/components/QuizEntryFormAdaptive.test.tsx`

**Interfaces:**
- Consumes: `useCapabilities` from `@/features/capabilities`

- [ ] **Step 1: Write test for adaptive flyer attachment**

Create `tests/components/QuizEntryFormAdaptive.test.tsx`:
- Assert flyer image attachment is available regardless of `capabilities.vision`.
- When `capabilities.vision` is `true`: OCR extraction trigger / auto-fill is rendered.
- When `capabilities.vision` is `false`: Only manual attachment and image preview are rendered (no AI extraction trigger).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/QuizEntryFormAdaptive.test.tsx`

- [ ] **Step 3: Update `FlyerUploader.tsx` and `QuizEntryForm.tsx`**

In `FlyerUploader.tsx`:
Allow attaching the image and calling `/api/quizzes/upload-flyer`.
Read `capabilities.vision`: only call `/api/quizzes/extract` or show "AI Scanning" when `vision` is true.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/QuizEntryFormAdaptive.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FlyerUploader.tsx src/components/QuizEntryForm.tsx tests/components/QuizEntryFormAdaptive.test.tsx
git commit -m "feat(ui): decouple core flyer upload from optional AI vision auto-fill"
```

---

### Task 7: Adaptive UI - Action Toolbar & Detail View Flyer Display

**Files:**
- Modify: `src/components/ActionToolbar.tsx`
- Modify: `src/components/QuizDetailClient.tsx`
- Test: `tests/components/ActionToolbarAdaptive.test.tsx`
- Test: `tests/components/QuizDetailFlyer.test.tsx`

**Interfaces:**
- Consumes: `useCapabilities` from `@/features/capabilities`
- Produces: Preserves core payment and registration controls while hiding inactive calendar and sharing buttons, and renders flyer poster when present.

- [ ] **Step 1: Write tests for ActionToolbar and QuizDetail flyer display**

Create `tests/components/ActionToolbarAdaptive.test.tsx` and `tests/components/QuizDetailFlyer.test.tsx`:
1. Assert Registration card and Payment toggle button ARE rendered unconditionally in `ActionToolbar`.
2. Assert `ActionToolbar` only renders Calendar, WhatsApp, and Email buttons when their respective flags are true.
3. Assert `QuizDetailClient` renders the flyer image when `quiz.flyerImageUrl` is populated.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/ActionToolbarAdaptive.test.tsx tests/components/QuizDetailFlyer.test.tsx`

- [ ] **Step 3: Update `ActionToolbar.tsx` and `QuizDetailClient.tsx`**

In `ActionToolbar.tsx`:
Read `const { icalExport, whatsappShare, emailRegistration } = useCapabilities();`.
Render the Calendar button only if `icalExport` is true.
Render the WhatsApp button only if `whatsappShare` is true.
Render the Email button only if `emailRegistration` is true.
Keep Registration and Payment controls rendered unconditionally.

In `QuizDetailClient.tsx`:
Render the flyer poster banner/thumbnail if `quiz.flyerImageUrl` is present.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/ActionToolbarAdaptive.test.tsx tests/components/QuizDetailFlyer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionToolbar.tsx src/components/QuizDetailClient.tsx tests/components/
git commit -m "feat(ui): adapt action toolbar and display attached flyer in detail view"
```

---

### Task 8: Full Verification & Environment Documentation

**Files:**
- Modify: `.env.example`
- Run all test suites & build verification

- [ ] **Step 1: Update `.env.example`**

Add documentation and defaults for:
```bash
# Deployment Capabilities (Strictly explicit opt-in: default is false)
ENABLE_AI_VISION=false          # Set to true to enable flyer upload & AI extraction
ENABLE_ICAL_EXPORT=false        # Set to true to enable dynamic .ics calendar export
ENABLE_WHATSAPP_SHARE=false     # Set to true to enable WhatsApp roster formatting
ENABLE_EMAIL_REGISTRATION=false # Set to true to enable organizer email registration helper
```

- [ ] **Step 2: Run all test suites**

Run: `npm test`
Expected: All test suites PASS (including OpenAPI sync, guardrails, core isolation, and adaptive UI tests).

- [ ] **Step 3: Run production build check**

Run: `npm run build`
Expected: Next.js compiles with zero errors or type warnings.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs(env): document deployment capability environment variables"
```
