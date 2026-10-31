# ADR 0002: Decouple Core Domain from Auxiliary Integrations

**Date:** 2026-10-31  
**Status:** Accepted  
**Deciders:** Core Engineering Team  

---

## Context & Problem Statement
The application originally bundled the core quiz coordination domain (quiz scheduling, team roster queueing, attendance state, and payment/registration tracking) alongside several auxiliary integrations:
- Multi-modal AI flyer extraction (OpenAI / Google Gemini Vision).
- Flyer image upload and persistence (Local filesystem / Vercel Blob).
- Calendar feed export (`.ics` generation).
- Messaging helpers (WhatsApp roster formatting, organizer mailto draft).

This monolithic coupling created tight dependencies on external APIs and environment variables, making it difficult to run a lightweight, self-hosted, or core-only deployment without missing API warnings or unused UI widgets. We need different deployment models based on which integrations are desired, while keeping the UI clean and native to the active feature set.

## Decision Drivers
- Zero third-party dependencies required for the core business domain.
- Self-hostable using only PostgreSQL and Next.js.
- Explicit opt-in flags instead of implicit or magical auto-detection.
- Adaptive UI without empty spaces or disabled placeholders when features are turned off.
- Backward-compatible contract tests guarding against API drift.

## Considered Options
1. **Option 1: Capability-Driven Modular Core within Monolith (Selected)**
   - Maintain a single deployable Next.js app, but reorganize code into an isolated Core domain and discrete feature modules (`src/features/*`).
   - Introduce a central capability registry (`src/features/capabilities/`) driven by granular environment variables (`ENABLE_AI_VISION`, `ENABLE_ICAL_EXPORT`, `ENABLE_WHATSAPP_SHARE`, `ENABLE_EMAIL_REGISTRATION`).
   - Conditionally render UI components so disabled integrations are completely hidden rather than shown disabled.
   - *Pros:* Easiest to implement, test, and deploy. Single Docker build and zero orchestration overhead. Allows starting lean immediately while cleanly defining the interfaces needed if splitting later.
   - *Cons:* Code for disabled modules remains in the codebase bundle.

2. **Option 2: Monorepo Workspaces (`packages/core` + `packages/integrations-*`)**
   - Split into independent packages via pnpm/Turborepo workspaces with isolated `package.json` dependencies.
   - *Pros:* Strict code-level dependency separation (no vision/blob packages installed for core).
   - *Cons:* Significantly higher operational and tooling overhead, complex cross-package UI bundling.

3. **Option 3: Core Monolith + Standalone Microservices**
   - Run AI flyer extraction and helper tools as standalone HTTP services queried by the core web app.
   - *Pros:* Independent deployment lifecycles and runtime scaling.
   - *Cons:* Excessive operational complexity for a quiz coordination app (inter-service networking, container management).

## Decision Outcome
We chose **Option 1 (Capability-Driven Modular Core within Monolith)** with **strictly explicit opt-in flags**:
- `ENABLE_AI_VISION=true`: Activates flyer upload and multi-modal AI extraction.
- `ENABLE_ICAL_EXPORT=true`: Activates dynamic `.ics` calendar event generation.
- `ENABLE_WHATSAPP_SHARE=true`: Activates roster formatting and WhatsApp sharing.
- `ENABLE_EMAIL_REGISTRATION=true`: Activates the organizer `mailto:` email registration helper.

**Auto-detection is rejected:** If a flag is unset or set to any value other than `"true"`, the integration is completely disabled by default. The presence of an API key (e.g. `GEMINI_API_KEY`) alone will never silently activate an auxiliary integration.

## Consequences
- **Positive:**
  - A lightweight self-hosted instance requires only PostgreSQL and Next.js (no OpenAI or Blob storage keys).
  - The UI is streamlined and native: creating a quiz without AI vision presents a clean manual entry form; detail views hide unused calendar or sharing buttons without empty gaps.
  - Core domain logic (`quizService`, `rsvpService`, `paymentService`, `registrationService`) has zero direct imports from third-party AI or storage SDKs.
  - Auxiliary endpoints return explicit 404 / 501 responses when invoked in deployments where they are disabled.
- **Negative / Trade-offs:**
  - Client components must consume deployment capabilities (via props or Context) to render conditionally.
  - Integration code remains present in the codebase even when deactivated at runtime.
- **Invariants Introduced:**
  - Core services must never import from `src/features/*`.
  - Feature activation requires explicit `"true"` environment variable flags.

## Validation & Confirmation
- Verified via Vitest capability registry unit tests (`tests/features/capabilities/capabilities.test.ts`), OpenAPI 3.1 contract tests (`tests/api/contract.test.ts`), and build checks.
