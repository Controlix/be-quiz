# Changelog

All notable changes to the **Pub Quiz App (BE-Quiz)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
