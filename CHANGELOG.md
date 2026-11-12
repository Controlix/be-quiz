# Changelog

All notable changes to the **Pub Quiz App (BE-Quiz)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v2.4.0] - 2026-11-11

### Added

- **Admin Role Management (`src/services/memberService.ts`, `src/actions/adminActions.ts`, `src/components/MemberRosterClient.tsx`):** Implemented role promotion and demotion directly in `/admin/members`, allowing administrators to elevate members to `ADMIN` or demote admins back to `USER`.
- **Partitioned Team Overview:** Redesigned `/admin/members` into two distinct sections (**Beheerders** and **Leden**) with dedicated headers, member counts, and contextual transfer buttons (`↑ Maak Beheerder` and `↓ Naar Leden`).
- **Confirmation Safety Modal:** Guarded role promotions and demotions behind the existing `ConfirmDialog` modal to prevent accidental privilege modifications on touchscreens.
- **Modal-Driven PIN Reset Confirmation:** Replaced legacy browser `window.confirm()` popups with `ConfirmDialog` for resetting teammate PINs.
- **Dedicated `AlertDialog` Component (`src/components/AlertDialog.tsx`):** Added a reusable notification/warning dialog replacing raw browser `window.alert()` calls with styled, accessible modal dialogs supporting `warning`, `error`, `info`, and `success` variants.
- **Complete Elimination of Native Browser Popups:** Replaced all legacy `window.confirm()` and `window.alert()` calls across `AdminFeedbackClient` and `MemberRosterClient` with accessible in-app `ConfirmDialog` and `AlertDialog` components.
- **Graceful Unauthorized Session Recovery:** When a demoted member attempts an admin operation in an already-open browser tab, the application displays a friendly warning dialog (_"Toegang Gewijzigd"_) explaining that their administrative rights were updated, with a 1-tap navigation button back to `/quizzes` where the "Beheer" link is removed.

### Architectural Changes & Safety Guardrails

- **Domain Service Isolation & Transactional Integrity (`src/services/memberService.ts`):** Encapsulated role change logic inside `prisma.$transaction`, strictly enforcing:
  - **Self-Demotion Guard:** Prevents an admin from accidentally revoking their own administrator rights.
  - **Sole Admin Guard:** Prevents demoting the team's last remaining administrator, eliminating accidental lockout.
  - **Idempotency:** Early return when the target member is already in the requested role.
- **Single Source of Truth State Derivation:** Maintained a single unified `members` state array in `MemberRosterClient`, deriving `admins` and `regularMembers` via pure `.filter()` projections without parallel arrays.

---

## [v2.3.0] - 2026-11-10

### Added

- **Lightweight Quiz Rating & Display (`src/services/ratingService.ts`, `src/components/QuizRatingWidget.tsx`, `src/actions/ratingActions.ts`):** Implemented a 1-to-5 star post-event evaluation system for concluded quizzes with strict individual vote privacy, server-side dynamic lineup filtering, optimistic client rating, accessible ARIA radio controls, and compact amber rating badges on dashboard cards.
- **`QuizRating` Database Model (`prisma/schema.prisma`, `docs/database/schema.md`):** Added dedicated `QuizRating` table with foreign key cascade deletion and unique `(quizId, memberId)` constraint.

---

## [v2.2.0] - 2026-11-07

### Added

- **Opportunistic Storage Garbage Collection (`src/lib/storagePruner.ts`, `src/lib/storagePrunerSubscriber.ts`):** Implemented an automated in-process garbage collector that prunes unreferenced quiz flyers and feedback screenshots across both local volume storage (`public/uploads`) and Vercel Blob (`@vercel/blob`).
- **Safe 24-Hour Retention Window (TTL):** Guaranteed that unreferenced files younger than 24 hours are never pruned, preventing disruption to in-flight quiz creation and feedback submission forms.
- **`asset.uploaded` Domain Event (`src/lib/events/types.ts`):** Added a decoupled domain event emitted by `saveUploadedFlyer` and `saveUploadedFeedbackImage` upon file save.
- **Architecture Decision Record (`docs/adr/0007-opportunistic-storage-garbage-collection.md`):** Formally documented the decision to adopt opportunistic background garbage collection over HTTP GET cron routes to preserve strict REST semantics and eliminate external cron complexity.
- **Standalone Maintenance CLI (`scripts/prune-uploads.ts`):** Refactored the CLI script with `--dry-run` and `--force` options for one-off storage audits and developer cleanups.

### Architectural Changes

- **Serverless Event-Driven Background Coordination (`src/instrumentation.ts`):** Hooked `registerStoragePrunerSubscriber` into Next.js `register()` on startup in the Node.js runtime. Pruning runs out-of-band via Next.js `after()` coordination on the domain event bus, ensuring zero perceptible latency for users uploading flyers or screenshots.
- **Process-Wide Cooldown Throttling:** Anchored `__beQuizLastPruneTimestamp` and `__storagePrunerSubscriberRegistered__` to `globalThis` to prevent duplicate concurrent scans across Next.js Webpack chunks and hot-module reloadings.

---

### Added

- **App Header Dynamic Team Name Branding (`src/components/QuizzesDashboard.tsx`, `src/services/quizService.ts`):** Enabled the main dashboard header to dynamically display the team name configured in `TeamSetting` via `getDefaultTeamName()` while falling back to `"KwisVrienden"` if unspecified.
- **External Integrations Specification (`docs/integrations.md`):** Added a comprehensive documentation guide and architectural diagram detailing all active zero-setup protocols (WhatsApp, email, iCal), credential-backed cloud integrations (AI vision, Vercel Blob, Google Calendar sync), and roadmap items.

### Changed

- **Next.js 16 Proxy Convention (`src/proxy.ts`):** Migrated deprecated `src/middleware.ts` to `src/proxy.ts` and renamed exported entrypoint to `export function proxy()`.
- **Gitignore `next-env.d.ts` (`.gitignore`):** Gitignored `next-env.d.ts` and untracked it from Git per Next.js 16 recommendations, preventing dirty working tree conflicts between `next dev` and `next build`.
- **Neutral Seed Team Name (`prisma/seed.ts`, `prisma/schema.prisma`):** Updated default singleton team name and database seed from `"Ben in Black"` to `"Onze Quizploeg"`.

---

## [v2.1.1] - 2026-11-06

### Fixed

- **GitHub Actions CI PostgreSQL Service Container (`.github/workflows/ci.yml`):** Added a `postgres:16-alpine` service container with container healthchecks (`pg_isready -U quiz -d be_quiz`), `DATABASE_URL` environment configuration, and automated `npx prisma db push` schema initialization so full verification and integration test suites run deterministically in CI.

### Added

- **Architecture Decision Record (`docs/adr/0005-ci-postgresql-service-container.md`):** Documented deciders, drivers, and considered options (Testcontainers vs. Prisma Mocking vs. GitHub Actions native service containers).

---

## [v2.1.0] - 2026-11-04

### Added

- **Repository Linter & Flat Configuration (`eslint.config.mjs`):** Configured ESLint 9 Flat Config with official Next.js Core Web Vitals (`@next/eslint-plugin-next`), React Server Components rules, and TypeScript-ESLint integration.
- **Prettier & Tailwind CSS v4 Class Sorting (`.prettierrc.json`):** Configured Prettier with `prettier-plugin-tailwindcss` to enforce consistent code formatting and deterministic Tailwind class ordering across all components.
- **Local Pre-Commit Secret Scanning (`.secretlintrc.json`, `.secretlintignore`):** Integrated `secretlint` to detect accidental leaks of API keys, private keys, JWT tokens, and database credentials before commits are made.
- **Dependency CVE Auditing & Allowlist (`audit-ci.json`):** Integrated `audit-ci` with temporary allowlists for existing upstream transitive vendor advisories (`deepmerge-ts` in `@prisma/config` and `zod` in `@vercel/blob`) ensuring clean exit codes while catching new high/critical vulnerabilities.
- **Git Hook Automation (`.husky/`, `.lintstagedrc.json`):** Configured Husky and `lint-staged` to execute sub-second format, lint, and secret checks strictly on staged files upon `git commit`.
- **Turnkey CI Workflows (`.github/`):** Added `.github/dependabot.yml` for automated dependency security tracking, `.github/workflows/ci.yml` for full verification builds, and `.github/workflows/security.yml` for GitHub CodeQL SAST and Gitleaks scanning.
- **Architecture Decision Record (`docs/adr/0004-code-quality-and-security-tooling.md`):** Documented deciders, drivers, considered options (ESLint vs. Biome, Secretlint vs. Docker/native scanners), and architectural invariants.

### Changed

- **Unified Developer Scripts (`package.json`):** Added `lint`, `lint:fix`, `format:check`, `format:write`, `audit:check`, `scan:secrets`, and `check:all` scripts.
- **Architecture Overview (`docs/architecture/overview.md`):** Updated Section 3 (Technology Stack) and added Section 6 (Developer Tooling & Security Standards).

---

## [v2.0.1] - 2026-11-04

### Fixed

- **Cross-Chunk Event Bus Singleton & Subscriber Idempotency (`src/lib/events/index.ts`, `src/features/calendar/shared/subscriber.ts`):** Anchored `domainEvents` to `globalThis.__domainEvents__` to prevent module closure divergence across Next.js Webpack chunks in serverless Lambda environments. Added container-level idempotency to `registerSharedCalendarSubscriber` on `globalThis.__calendarSubscriberRegistered__` to prevent duplicate listeners during warm container reuse.

### Added

- **Architectural Invariant 9 (`docs/architecture/overview.md`, `AGENTS.md`):** Formally codified "Cross-Chunk In-Process Singleton Persistence" prohibiting file-level module singletons for server runtime infrastructure.
- **Regression Test Suite (`tests/unit/events/bus-singleton.test.ts`):** Added automated Vitest tests verifying cross-chunk singleton sharing and subscriber idempotency.

---

## [v2.0.0] - 2026-11-01

### Added

- **Shared Team Google Calendar Integration (`src/features/calendar/shared/`):** Automated server-side synchronization of officially registered pub quizzes to the team's shared Google Calendar via Google Calendar API v3 and Google Cloud Service Account credentials.
- **In-Process Domain Event Bus (`src/lib/events/`):** Strongly-typed, decoupled event bus emitting fine-grained domain events (`team.registered`, `team.registration_cancelled`, `quiz.details_updated`, `team.roster_changed`, `team.payment_changed`, `quiz.cancelled`) from core domain services without blocking user HTTP requests.
- **Serverless Background Execution Support (`src/lib/events/bus.ts`):** Dynamically coordinates background subscriber promises with Next.js `after()` (`next/server`) inside server request contexts so Vercel/serverless runtimes do not terminate before Google Calendar API network calls complete.
- **Self-Healing Calendar Sync:** Handled HTTP 404/410 responses gracefully; external manual deletions in Google Calendar automatically self-heal upon re-registration or clean up stale mapping entries on subsequent updates.
- **Zero-Dependency Google OAuth2 Client (`googleCalendarClient.ts`):** Lightweight client using native Node.js `crypto` RSA-SHA256 JWT assertions (zero heavy SDK dependencies), in-memory access token caching, and automatic multiline PEM private key newline normalization.
- **Isolated Database Model (`prisma/schema.prisma`):** Added `CalendarEventMapping` database model maintaining complete schema independence for the core domain models (`Quiz`, `Team`).
- **Capability Gating & Startup Hook:** Integrated under `ENABLE_SHARED_GOOGLE_CALENDAR=true` capability flag and Next.js server initialization in `src/instrumentation.ts`.

---

## [v1.1.0] - 2026-10-31

### Architectural Changes & Decoupling

- **Decoupled Integrations from Core Domain:** Refactored core business logic to operate with zero third-party API dependencies (Google Gemini, OpenAI, Vercel Blob, iCal, WhatsApp, Mailto).
- **Capability Registry (`src/features/capabilities/`):** Added centralized runtime detection and opt-in flags (`ENABLE_AI_VISION`, `ENABLE_ICAL_EXPORT`, `ENABLE_WHATSAPP_SHARE`, `ENABLE_EMAIL_REGISTRATION`).
- **Adaptive UI:** UI adapts dynamically to active capabilities with no empty gaps or disabled placeholders.
- **Contract Testing:** Added automated Vitest contract tests validating HTTP endpoints against the OpenAPI 3.1 specification (`docs/api/openapi.yaml`).
- **Architecture Documentation:** Documented architectural invariants and boundaries in `docs/architecture/overview.md` and [ADR 0002](docs/adr/0002-decouple-core-from-auxiliary-integrations.md).

### Features & Polish

- **Unified RSVP State Synchronization:** Refactored `QuizDetailClient.tsx` to use a pure state reducer (`src/lib/rsvpReducer.ts`) as a single source of truth, eliminating desynchronization between lineup cards and RSVP buttons.
- **Declined Players Visibility:** Added an _"Afgemeld"_ section chip display in `TeamLineup.tsx` allowing teammates to see who declined, plus a 1-tap `+ Aanmelden` admin override action.
- **Standalone Flyer Upload:** Allowed flyer image uploads (`POST /api/quizzes/upload-flyer`) independent of AI OCR, displaying full flyer artwork on quiz details.

---

## [v1.0.1] - 2026-10-25

### Added

- **In-App Feedback Tool:** Floating modal tool with automatic HTML5 viewport canvas screenshot capture.
- **Admin Feedback Dashboard:** Desktop back-office dashboard (`/admin/feedback`) to review user suggestions and visual bug reports.
- **Decoupled Registration Confirmation:** Standalone confirmation toggle separating mail composition from registration state.

---

## [v1.0.0] - 2026-10-24

### Foundational MVP Release

- **Mobile-first PWA:** Responsive quiz coordination interface designed for mobile phone screens.
- **Flyer Upload & OCR:** AI Vision-based flyer scanning for auto-extracting date, title, venue, and entry fees.
- **Transactional RSVP Queue:** First-come, first-served lineup management with automatic waitlist promotion.
- **Decoupled Schema:** Independent `Quiz` and `Team` models enabling multiple teams per event.
- **Passwordless PIN Auth:** Session token-based authentication via invite links and 4-digit PINs.
- **Email Registration:** Mailto template generation for team registrations.
