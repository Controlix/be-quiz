# Changelog

All notable changes to the **Pub Quiz App (BE-Quiz)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **Declined Players Visibility:** Added an *"Afgemeld"* section chip display in `TeamLineup.tsx` allowing teammates to see who declined, plus a 1-tap `+ Aanmelden` admin override action.
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
