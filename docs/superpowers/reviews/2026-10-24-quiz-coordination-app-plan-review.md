# Plan Review: Pub Quiz Coordination App (BE-Quiz) Implementation Plan

**Date:** 2026-10-24  
**Reviewed document:** `docs/superpowers/plans/2026-10-24-quiz-coordination-app.md`  
**Referenced specification:** `docs/superpowers/specs/2026-10-24-quiz-coordination-app-design.md` (Revised Round 3)  
**Status:** Requires Revision (Not yet sound for autonomous execution)

---

## 1. Executive Summary

The implementation plan establishes a clear product vision, adopts the approved tech stack (Next.js 15, TypeScript 5, Tailwind CSS, Prisma, PostgreSQL 16), and uses an outside-in, vertical-slice delivery model. 

However, **the plan is not yet sound for autonomous execution** (e.g. via `subagent-driven-development` or `executing-plans`). It suffers from:
1. **Misinterpreted Review Focus:** Primary happy paths are listed instead of uncovered edge cases / failure modes.
2. **Mega-Task Sizing (Task 7):** Ten files across three distinct domains are bundled with only one minimal test.
3. **Missing Interface Contracts:** `Consumes` is omitted across all tasks, and `Produces` lacks exact TypeScript types and signatures.
4. **Step Granularity & TDD Violations:** Multi-component scaffolding is packed into single steps; all 9 acceptance criteria tests are dumped into Task 8's implementation step.
5. **Architectural Gaps:** The client mutation pattern (Server Actions vs API routes) is undeclared; `.env` configuration is omitted; object storage for flyers is unspecified; admin RSVP override and capacity demotions lack service-level definitions.

---

## 2. Detailed Findings

### F1 — "Review Focus" Lists Happy Paths, Not Uncovered Failure Modes (Major)
* **Standard:** Per the `writing-plans` specification, Review Focus must name *"the five input classes or failure modes the spec implies but no task's tests exercise that are most likely to bite a person using this software... with the test that pins it to the task that owns the code."*
* **In the Plan:**
  1. *Immediate Clickable Validation (Slice 1)* — A feature milestone, not a failure mode.
  2. *Concurrent RSVPs at Capacity Limit* — Already the explicit test in Task 4.
  3. *Promotion on Attendee Decline* — Already the secondary assertion in Task 4.
  4. *Flyer Extraction Missing Fields* — Already the test in Task 5.
  5. *Zero-RSVP Registration Email* — Already the test in Task 6.
* **Missing Failure Modes That Must Be Pinned:**
  - **Vision AI 15s Timeout / 5xx Fallback:** Test that a timeout or provider error aborts gracefully and renders the manual entry form with a Dutch notification banner (Design Spec §7.3 & AC 8).
  - **Admin RSVP Override Audit & Promotion:** Test that an admin decline override sets `overriddenById` and `overriddenAt`, triggers FIFO reserve promotion, and that a subsequent member self-RSVP clears the override audit fields (Decision D7 / C5).
  - **Lowering `maxTeamSize` Demotion:** Test that when `maxTeamSize` is reduced (e.g. from 5 to 4), the attendee with the latest `queuedSince` is moved to reserve #1 while strictly preserving their original `queuedSince` timestamp (Decision D9).
  - **PWA Standalone Cookie Isolation Fallback:** Test that an unauthenticated user on `/auth/login` inside an installed standalone PWA can paste an invite token to establish a valid 90-day session (Spec §4.2 & AC 7).
  - **Flyer File Validation:** Test that server endpoints reject non-image MIME types or files >4MB with a descriptive Dutch error message (Spec §7.3).

---

### F2 — Task 7 Bundles Too Many Unrelated Concerns (Blocker)
* **Current Scope:** Task 7 combines 10 files:
  - `src/lib/crypto.ts`
  - `src/lib/auth.ts`
  - `src/middleware.ts`
  - `src/app/auth/login/page.tsx`
  - `src/app/auth/join/route.ts`
  - `src/app/auth/logout/route.ts`
  - `src/app/quizzes/[id]/edit/page.tsx`
  - `src/app/admin/members/page.tsx`
  - `src/app/admin/settings/page.tsx`
  - `src/components/ConfirmDialog.tsx`
* **Deficiency:** The provided test only verifies `createSession` and `validateSession`. None of the route handlers, middleware access controls, admin permissions, confirmation modals, or token regeneration behaviors are tested.
* **Required Resolution:** Split Task 7 into at least two distinct tasks:
  1. **Task 7A (Auth, Sessions & Middleware):** Crypto utilities, session management, middleware route gating, `/auth/login`, `/auth/join`, and `/auth/logout`.
  2. **Task 7B (Admin Management & Edit Flows):** Admin quiz edit/cancellation, member roster management, default team settings, and client `ConfirmDialog`.

---

### F3 — Incomplete Interface Contracts Across All Tasks (Major)
* **Standard:** In subagent execution, an implementer only sees their own task. The `Interfaces` block is their single contract for what upstream code provides and what downstream tasks expect.
* **In the Plan:**
  - `Consumes` is completely missing from all tasks.
  - `Produces` provides prose bullet points (e.g., *"Interactive tabs filtering realistic mock quiz data"*, *"Quiz detail screen showing flyer preview banner"*) rather than exact TypeScript signatures, props, and return types.
* **Required Resolution:** Provide exact TypeScript definitions, e.g.:
  ```typescript
  // Consumes
  import { QuizStatus } from "@prisma/client";

  // Produces
  export function categorizeQuizForTabs(quiz: {
    startsAt: Date;
    status: QuizStatus;
    registeredAt: Date | null;
  }): "IN_BERAAD" | "GEPLAND" | "ARCHIEF";

  export interface TimelineTabsProps {
    quizzes: QuizWithTeamAndRsvpCount[];
    activeTab: "IN_BERAAD" | "GEPLAND" | "ARCHIEF";
    onTabChange: (tab: "IN_BERAAD" | "GEPLAND" | "ARCHIEF") => void;
  }
  ```

---

### F4 — Undeclared App Router Mutation Pattern (Major)
* **Problem:** Task 4 states *"update `src/app/quizzes/page.tsx` and `src/app/quizzes/[id]/page.tsx` to read and mutate live PostgreSQL data"*. It leaves open whether mutations occur via Next.js Server Actions or dedicated REST API routes.
* **Consequence:** Implementers on different tasks may mix patterns (e.g., half Server Actions, half `fetch('/api/...')`), creating inconsistent error handling, revalidation, and testing patterns.
* **Required Resolution:** Standardize explicitly on Next.js **Server Actions** located in `src/actions/` (e.g., `src/actions/rsvpActions.ts`, `src/actions/quizActions.ts`, `src/actions/adminActions.ts`).

---

### F5 — Environment Setup and Database Bootstrapping Omitted (Major)
* **Problem:** Task 3 sets up `docker-compose.yml` and runs `npx prisma migrate reset`, but no `.env` file or environment variables (`DATABASE_URL`) are created or documented.
* **Consequence:** An automated subagent running `npx prisma migrate reset` in Step 4 will fail immediately because `DATABASE_URL` is undefined.
* **Required Resolution:** Add `.env.example` and `.env` initialization to Task 3 with standard local Postgres credentials:
  ```env
  DATABASE_URL="postgresql://quiz:quiz@localhost:5432/be_quiz?schema=public"
  ```

---

### F6 — Flyer Storage Architecture Unspecified (Major)
* **Problem:** Task 5 extracts flyer details and sets `Quiz.flyerImageUrl`. However, the plan does not define where or how the flyer file is stored (e.g., local public uploads directory for dev, mock S3, or Vercel Blob).
* **Required Resolution:** Define a lightweight local/dev storage adapter (`src/lib/storage.ts`) or dedicated upload route (`/api/upload`) that saves images to a designated directory and returns a public/signed path.

---

### F7 — Task 8 Violates TDD by Embedding Acceptance Test Suite in Step 3 (Major)
* **Problem:** In Task 8, Step 3 states: *"Create `public/manifest.json` and mobile icons; configure `output: "standalone"` in `next.config.ts`; build multi-stage `Dockerfile`; write `tests/e2e/acceptance.test.ts` covering all 9 criteria from Section 9 of the design spec."*
* **Deficiency:**
  - Creating all 9 acceptance tests is treated as a sub-step of a DevOps task.
  - Tests are written *during implementation* rather than as failing tests before implementation.
* **Required Resolution:** Separate the 9 acceptance tests into their own dedicated Task or make them the initial failing steps before completing final packaging.

---

## 3. Recommended Task Re-Alignment (9 Tasks)

To make the plan fully executable, it should be re-aligned into 9 bite-sized tasks:

| # | Task Title | Core Deliverables | Key Test |
|---|---|---|---|
| **1** | Mobile Layout & Timeline Tabs (Mock) | Layout, mock data, `TimelineTabs`, `QuizCard` | Tab classification logic & status badge rendering |
| **2** | Quiz Detail & Interactive RSVP (Mock) | Detail view, `TeamLineup`, `RsvpControl`, `ActionToolbar` | Reserve badge formatting & client RSVP queue shifts |
| **3** | PostgreSQL Docker, `.env` & Prisma Schema | `docker-compose.yml`, `.env`, `schema.prisma`, `seed.ts` | TeamSetting query & relationship integrity |
| **4** | Concurrency-Locked RSVP Engine & Actions | `quizService.ts`, `rsvpService.ts`, Server Actions | PostgreSQL row lock concurrency & FIFO promotion |
| **5** | Flyer Intake, Canvas Resize & Vision API | Canvas downscaling, Vision LLM parsing, timeout fallback | Schema parsing validation, 15s timeout fallback |
| **6** | Mailto, Calendar (.ics) & WhatsApp Hand-Off | `mailto.ts`, `ical.ts`, `whatsapp.ts`, payment toggle | RFC 6068 email copy (no player names), RFC 5545 .ics |
| **7** | Authentication, Sessions & Middleware | SHA-256 tokens, session cookies, Next.js middleware, `/auth/*` | Token claim, session creation, PWA manual paste claim |
| **8** | Admin Controls & Confirmation Guards | `/quizzes/[id]/edit`, `/admin/*`, `ConfirmDialog`, RSVP override | Admin decline audit trail, team size demotion |
| **9** | PWA Manifest, Docker Packaging & Acceptance Suite | `manifest.json`, standalone Dockerfile, E2E acceptance tests | PWA manifest validation & 9 spec acceptance criteria |

---

## 4. Next Steps

1. Update `docs/superpowers/plans/2026-10-24-quiz-coordination-app.md` with:
   - The 9-task breakdown.
   - Exact TypeScript interface signatures (`Consumes` / `Produces`).
   - Server Actions mutation pattern in `src/actions/`.
   - The 5 true failure modes in `Review Focus`.
2. Confirm the revised plan before starting implementation.
