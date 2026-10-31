# Design Document: Decouple Core Domain from Auxiliary Integrations

## 1. Intent and Why
Currently, **be-quiz** is implemented as a monolithic Next.js application where core event and RSVP management logic is tightly integrated with auxiliary capabilities (AI flyer extraction via OpenAI Vision, local/Vercel Blob storage, `.ics` calendar generation, WhatsApp lineup formatting, and email registration mailto links).

The purpose of this refactoring is to decouple the **Core Domain** (Quiz lifecycle, team roster queueing, attendance state, and payment tracking) from **Auxiliary Integrations**. This enables flexible deployment profiles—ranging from an ultra-lightweight, zero-external-dependency self-hosted deployment (pure Next.js + PostgreSQL) to a fully equipped deployment with multi-modal AI and automated messaging—with the user interface adapting dynamically to only display features enabled in that deployment.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Core Independence:** Ensure the core domain and its service layer (`quizService`, `rsvpService`, `registrationService`, `paymentService`) can operate fully without requiring external APIs (OpenAI API key, Vercel Blob tokens, external mail/calendar feeds).
- **Capability Registry:** Provide a centralized, type-safe configuration system (`src/features/capabilities.ts`) driven by environment variables (`ENABLE_AI_VISION`, `ENABLE_CALENDAR`, `ENABLE_SHARING`) with sensible auto-detection fallbacks.
- **Dynamic UI Adaptation:** Ensure UI components (e.g. `QuizEntryForm`, `ActionToolbar`, `QuizDetailClient`) conditionally render only features supported by the active deployment capabilities:
  - If Vision is disabled: omit flyer dropzone and OCR autofill, showing a clean manual quiz creation form.
  - If Calendar is disabled: omit `.ics` download / calendar sync buttons.
  - If Sharing is disabled: omit WhatsApp lineup export and email registration links.
- **Safe API Guardrails:** Route handlers for integrations (`/api/quizzes/extract`, `/api/quizzes/[id]/calendar.ics`) return a clean HTTP 501 (Not Implemented) or 404 when disabled.
- **Architectural Clarity & Future-Proofing:** Isolate integrations behind clean interfaces and modular folder boundaries (`src/features/*`), enabling a seamless future transition to a monorepo workspace or standalone microservices if needed.

### Non-Goals
- **Physical Monorepo Split (in this phase):** We are not currently separating the repository into Turborepo/pnpm packages or separate npm modules.
- **Microservices Deployment (in this phase):** We are not deploying separate Docker microservice containers for AI vision or calendar feeds.
- **Database Schema Breaking Changes:** We are not altering the underlying Prisma relational schema or dropping nullable columns like `flyerImageUrl`.

### Anti-Goals
- **Dead UI Elements:** We will NOT render greyed-out, disabled, or "upgrade/configure to use" placeholder buttons in the UI for disabled integrations; the UI must look and feel natively designed for the enabled feature set.
- **Scattered `process.env` Checks:** We will NOT sprinkle ad-hoc `process.env.OPENAI_API_KEY` or `process.env.ENABLE_VISION` checks across arbitrary components or database services. All capability queries must go through the single capability registry.

---

## 3. Constraints
- **Next.js App Router (React 19 / Server Components):** Capability checks on the server must work seamlessly in Server Components and Server Actions. Client Components must receive capability flags via props or a lightweight capability context/provider.
- **Zero Runtime Overhead for Core:** When integrations are disabled, no network calls or module crashes should occur due to missing third-party environment variables.
- **Database Compatibility:** SQLite / PostgreSQL schema fields like `flyerImageUrl` remain nullable so that core-only records work seamlessly.

---

## 4. Evaluated Approaches & Selection

### Approach 1: Capability-Driven Modular Core within Monolith (Selected)
- **Description:** Maintain a single deployable app, but refactor code into an isolated Core and discrete feature modules (`src/features/vision`, `src/features/calendar`, `src/features/sharing`) managed by a central capability registry.
- **Trade-offs:** 
  - *Pros:* Simplest to implement, test, and deploy. Single Docker build. Effortless deployment configuration via environment variables. Paves the exact boundary lines needed for future extraction.
  - *Cons:* Code for disabled modules remains present in the codebase.
- **Decision:** **Accepted.** Best balance of simplicity, operational speed, and structural decoupling.

### Approach 2: Monorepo Workspaces (`packages/core` + `packages/integrations-*`)
- **Description:** Split codebase using pnpm/Turborepo workspaces into independent packages with distinct `package.json` dependencies.
- **Trade-offs:** 
  - *Pros:* Physical dependency isolation (no OpenAI SDK in core).
  - *Cons:* High tooling overhead, complex cross-package UI bundling, and slower iteration.
- **Decision:** **Deferred.** Can be adopted in a future phase if multi-package distribution is strictly required.

### Approach 3: Independent Microservices via HTTP/Webhooks
- **Description:** Run AI vision and helper tools as standalone HTTP services queried by the core app.
- **Trade-offs:** 
  - *Pros:* Independent deployment lifecycles and runtimes.
  - *Cons:* Excessive operational complexity (networking, service discovery, container orchestration).
- **Decision:** **Rejected for current scope.**

---

## 5. Architectural Specifications & Decisions

### 5.1 Capability Registry (`src/features/capabilities/`)
A centralized module defining the deployment capabilities:
```typescript
export interface AppCapabilities {
  vision: boolean;            // ENABLE_AI_VISION === "true"
  icalExport: boolean;        // ENABLE_ICAL_EXPORT === "true"
  whatsappShare: boolean;     // ENABLE_WHATSAPP_SHARE === "true"
  emailRegistration: boolean; // ENABLE_EMAIL_REGISTRATION === "true"
}
```
- **Resolution Strategy (Strictly Explicit Opt-In):**
  - Every integration capability defaults to `false` unless its environment variable is strictly equal to `"true"`.
  - Auto-detection based on API keys alone is explicitly disallowed to prevent unexpected runtime behavior or accidental API costs.
  - `vision`: `env.ENABLE_AI_VISION === "true"` (and requires a valid `GEMINI_API_KEY` or `OPENAI_API_KEY` to process requests).
  - `icalExport`: `env.ENABLE_ICAL_EXPORT === "true"`.
  - `whatsappShare`: `env.ENABLE_WHATSAPP_SHARE === "true"`.
  - `emailRegistration`: `env.ENABLE_EMAIL_REGISTRATION === "true"`.
- **Exported Helpers:**
  - `getCapabilities(env?: NodeJS.ProcessEnv): AppCapabilities` (Server-side evaluation)
  - `useCapabilities(): AppCapabilities` (Client-side hook / context provider for client components)

### 5.2 Directory Boundaries
Reorganize auxiliary code into modular feature folders:
```text
src/
├── features/
│   ├── capabilities/       # Capability registry, types, hooks, context provider
│   ├── vision/             # Vision service, flyer OCR prompt, storage adapters
│   ├── calendar/           # iCal feed generator and formatter (.ics export)
│   └── sharing/            # WhatsApp text generator, mailto drafts
├── services/               # Core business domain logic (quizService, rsvpService, paymentService, registrationService)
├── actions/                # Next.js Server Actions (mutations & controller layer)
└── components/             # UI presentation layer
```

### 5.3 UI Adaptations
1. **Quiz Creation (`src/components/QuizEntryForm.tsx`):**
   - Reads `capabilities.vision`.
   - If `vision` is active: renders `FlyerUploader` alongside manual inputs and connects OCR autofill.
   - If `vision` is inactive: renders a clean, focused form (title, startsAt, location, maxTeamSize, entryFee, notes) with zero flyer/OCR dropzone.
2. **Event Actions & Core Controls (`src/components/ActionToolbar.tsx`):**
   - **Core Controls (Preserved Always):** The Team Registration status toggle and Entry Fee payment status toggle belong to the **Core Domain**. They remain fully visible and operational even if all auxiliary integrations are disabled.
   - **Auxiliary Integration Buttons (Conditionally Rendered):**
     - `Add to Calendar` button only renders if `capabilities.icalExport` is `true`.
     - `WhatsApp Roster` button only renders if `capabilities.whatsappShare` is `true`.
     - `Email Registration` button only renders if `capabilities.emailRegistration` is `true` (and `organizerEmail` is set).
   - If auxiliary sharing/calendar buttons are disabled, the action toolbar adjusts its layout to cleanly display only the core Payment and Registration cards without empty gaps.
3. **Quiz Detail View (`src/components/QuizDetailClient.tsx`):**
   - If a quiz already contains a `flyerImageUrl`, the image thumbnail/lightbox continues to render as static visual content (using standard `<img>`, requiring zero external services). New uploads or OCR scans are only offered if `capabilities.vision` is active.

### 5.4 Route Handlers Guardrails & OpenAPI Synchronization
- `src/app/api/quizzes/extract/route.ts`: Checks `getCapabilities().vision`. If false, returns `501 Not Implemented` with `{ error: "AI vision extraction is disabled in this deployment." }`.
- `src/app/api/quizzes/[id]/calendar.ics/route.ts`: Checks `getCapabilities().icalExport`. If false, returns `501 Not Implemented` or `404 Not Found`.
- **OpenAPI Drift Prevention:** An automated Vitest test suite (`tests/api/openapi-sync.test.ts`) verifies:
  1. Every route handler in `src/app/api/**` and `src/app/auth/**` is fully registered with matching HTTP methods in `docs/api/openapi.yaml`.
  2. The OpenAPI YAML file conforms to valid OpenAPI 3.1 syntax.
  3. Response payloads from route handler integration tests conform to the documented OpenAPI response schemas.

---

## 6. What's Left to the Builder
- Implementing `tests/api/openapi-sync.test.ts` to enforce that code and `docs/api/openapi.yaml` stay synchronized on every test run.
- Choosing whether to pass `capabilities` via a top-level React Context (`CapabilitiesProvider`) in `src/app/layout.tsx` or as explicit props down from Server Components (both are valid; Context is recommended for ease of access in nested components).
- Updating existing test suites (`tests/`) to assert that core tests execute without mocking external OpenAI / storage services, and adding tests for capability-disabled behaviors.
- Ensuring Docker and local environment scripts (`.env.example`) document the new capability flags clearly.
