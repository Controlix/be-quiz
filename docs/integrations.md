# External Integrations Overview

This document provides a comprehensive overview of all external systems, APIs, protocols, and third-party integrations supported or planned in the **BE-Quiz** application, distinguishing between zero-setup generic protocols, infrastructure-provisioned integrations, and pending roadmap items.

---

## Summary Matrix

| Integration / Feature Category  | Setup Requirement           | Status                | Supported Platforms / Protocols          | Description & Implementation Details                                                                                                                                            |
| :------------------------------ | :-------------------------- | :-------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WhatsApp Sharing**            | **Zero-Setup (Generic)**    | **Active**            | WhatsApp Click-to-Chat (`wa.me`)         | Pre-fills friendly greetings, join links, and event details for sharing invites or quiz notifications over WhatsApp.                                                            |
| **Email Registration**          | **Zero-Setup (Generic)**    | **Active**            | Standard `mailto:` protocol              | Pre-fills organizer email addresses and structured registration body text for mail-based quiz sign-ups.                                                                         |
| **iCalendar (`.ics`) Export**   | **Zero-Setup (Generic)**    | **Active**            | RFC 5545 iCalendar standard              | Generates `.ics` calendar subscription feeds and downloadable event files so players can add quizzes to Apple Calendar, Outlook, etc.                                           |
| **Google Calendar Web Links**   | **Zero-Setup (Generic)**    | **Active**            | Google Calendar Web URL API              | Generates direct web links (`calendar.google.com/calendar/render`) pre-populated with quiz title, start/end times, and location.                                                |
| **AI Vision / OCR**             | **Specific Setup Required** | **Active**            | Google Gemini Vision / OpenAI Vision     | Scans uploaded quiz flyer images or poster attachments to automatically extract structured event metadata (title, date, time, location, team size, entry fee, organizer email). |
| **Cloud Object Storage**        | **Specific Setup Required** | **Active**            | Vercel Blob (`@vercel/blob`)             | Stores uploaded quiz flyers and feedback diagnostic screenshots in cloud blob storage, with local filesystem fallback.                                                          |
| **Shared Google Calendar Sync** | **Specific Setup Required** | **Active**            | Google Calendar API v3 (Service Account) | Server-side background synchronization of team quizzes directly into an organization's central Google Calendar via service account credentials.                                 |
| **Maps & Navigation**           | **Specific Setup Required** | **Planned (Roadmap)** | Google Maps / Apple Maps / Waze          | Tapping venue addresses on quiz cards or detail views to open direct route navigation in external map apps.                                                                     |

---

## Integration Architecture Diagram

```mermaid
graph TD
    subgraph Client ["BE-Quiz Web App (Client / Server Actions)"]
        UI[UI Components & Dashboard]
        FlyerUploader[Flyer Uploader]
        QuizDetail[Quiz Details & RSVPs]
    end

    subgraph External ["External Systems & Platforms"]
        WhatsApp["WhatsApp Sharing<br/>(wa.me Deep Links)"]:::generic
        Email["Email Registration<br/>(mailto: Protocol)"]:::generic
        ICS["iCalendar Export<br/>(.ics File Generation)"]:::generic
        GCalWeb["Google Calendar Web URL<br/>(calendar.google.com)"]:::generic
        AI["AI Vision APIs<br/>(Gemini / OpenAI Keys)"]:::specific
        Blob["Cloud Object Storage<br/>(Vercel Blob / Local FS)"]:::specific
        GCalShared["Shared Google Calendar Sync<br/>(Service Account & Calendar ID)"]:::specific
        Maps["Maps & Navigation<br/>(Google / Apple / Waze)"]:::planned
    end

    FlyerUploader -->|Image Upload / OCR| AI
    FlyerUploader -->|Store Flyer / Screenshot| Blob
    QuizDetail -->|Background Sync| GCalShared
    QuizDetail -->|Share Invites| WhatsApp
    QuizDetail -->|Sign up| Email
    QuizDetail -->|Export Feed| ICS
    QuizDetail -->|Web Link| GCalWeb
    QuizDetail -->|Open Venue Location| Maps

    classDef generic fill:#e2f0d9,stroke:#385723,stroke-width:2px,color:#274e13;
    classDef specific fill:#cfe2ff,stroke:#0d6efd,stroke-width:2px,color:#084298;
    classDef planned fill:#fff3cd,stroke:#ffc107,stroke-width:2px,color:#664d03;
```

**Legend:**

- <span style="background-color: #e2f0d9; color: #274e13; padding: 2px 6px; border-radius: 4px;">Green (Generic)</span> = Zero-Setup Protocol Links (Always work when enabled)
- <span style="background-color: #cfe2ff; color: #084298; padding: 2px 6px; border-radius: 4px;">Blue (Specific)</span> = Infrastructure & Credential Setup Required
- <span style="background-color: #fff3cd; color: #664d03; padding: 2px 6px; border-radius: 4px;">Yellow (Planned)</span> = Planned / Roadmap Integration (NYI)

---

## Dynamic Capability Guardrails

BE-Quiz implements a strict capabilities pattern (`src/features/capabilities/`) evaluated at runtime from environment variables:

1. **Conditional UI Rendering:** Components check active capabilities (`useCapabilities()`) before rendering integration-dependent UI elements (e.g., the AI Flyer Upload tab in `QuizEntryForm` is hidden or disabled when `vision` is false).
2. **Graceful Fallbacks:** If an integration is unconfigured, the app falls back cleanly (e.g., manual entry) rather than presenting broken functionality.
3. **Storage & AI Synergy:** The Flyer Uploader relies on both AI Vision (to parse text) and Cloud Storage (to persist the uploaded poster). When either is disabled, the system steers users toward manual entry, preventing orphaned or useless flows.
