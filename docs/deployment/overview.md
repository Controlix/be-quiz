# Deployment Guide & Compute Models: be-quiz

This document outlines the deployment models, compute execution environments, build pipelines, and operational procedures for **be-quiz**.

For the logical application architecture and service boundaries, consult [Architecture Overview](../architecture/overview.md). For physical backing services, databases, and storage topologies, consult [Infrastructure Overview](../infrastructure/overview.md).

---

## 1. Deployment Models Summary

be-quiz supports two primary compute deployment models:

| Aspect | Model A: Vercel (Serverless PaaS) | Model B: Docker (Standalone Container) |
| :--- | :--- | :--- |
| **Primary Target** | Managed production cloud hosting | Self-hosted VPS, Docker Compose, Fly.io, AWS ECS, Kubernetes |
| **Compute Engine** | AWS Lambda / Vercel Serverless Functions | Long-running Node.js process (`node server.js`) |
| **Process Lifecycle** | Ephemeral (spin-up on demand, scales to zero) | Persistent long-running daemon |
| **Build Artifact** | Vercel Serverless Output (`.vercel/output`) | Next.js Standalone Build (`.next/standalone`) |
| **Port / Binding** | Handled automatically by Vercel edge router | Binds to `0.0.0.0:3000` (configurable via `PORT` / `HOSTNAME`) |
| **Static Assets** | Automatically served via Vercel Edge CDN | Served directly by standalone Node or via fronting reverse proxy |

---

## 2. Model A: Vercel Serverless PaaS

Vercel provides native zero-configuration deployments for Next.js App Router applications.

### 2.1 How it Operates
* **React Server Components & Server Actions:** Compiled into serverless Lambda functions routed automatically by the Vercel edge network.
* **Cold Starts & Scaling:** Invocations scale instantaneously with incoming traffic and terminate when idle.
* **Static Assets:** Bundled static files (`/_next/static/*`) and static public assets are offloaded to Vercel's global CDN edge caches.
* **Background Tasks & Event Bus (Serverless Safety):** Domain events dispatched asynchronously by core services (e.g. shared Google Calendar updates on team registrations, RSVP changes, or payment updates) are dynamically scheduled via Next.js `after()` (`next/server`). This instructs the serverless platform to keep the lambda execution context alive until background network calls and database mappings resolve, preventing premature function freezing when user responses complete. Outside of active request scopes (such as Vitest tests, database seeds, or standalone scripts), tasks run safely in standard unblocked background promises.

### 2.2 Production Setup Steps
1. **Repository Import:** Connect the GitHub repository in [vercel.com/new](https://vercel.com/new).
2. **Environment Variables:**
   * `DATABASE_URL`: Managed PostgreSQL connection string (see [Infrastructure](../infrastructure/overview.md#1-database-layer-postgresql)).
   * `BLOB_READ_WRITE_TOKEN`: Required for flyer and feedback image uploads when using Vercel Blob.
   * `APP_URL`: Production domain URL (e.g., `https://quiz.example.com`).
   * **Optional Modular Capability Flags (Default: `false`):**
     * `ENABLE_AI_VISION`: Set to `true` to enable flyer AI scanning (requires `GEMINI_API_KEY` or `OPENAI_API_KEY`).
     * `ENABLE_ICAL_EXPORT`: Set to `true` to enable dynamic `.ics` calendar export and personal "Add to Google Calendar" links.
     * `ENABLE_SHARED_GOOGLE_CALENDAR`: Set to `true` to enable automated shared team Google Calendar synchronization (requires `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`).
     * `ENABLE_WHATSAPP_SHARE`: Set to `true` to enable WhatsApp lineup sharing.
     * `ENABLE_EMAIL_REGISTRATION`: Set to `true` to enable email registration mailto actions.
     *(See [Section 5](#5-capability-flags--optional-integrations) for details).*
3. **Database Migration & Seeding:**
   Run migrations and seed the initial admin user using your remote connection string:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma db push
   DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
   ```

---

## 3. Model B: Docker Standalone Container

The application includes a production-grade multi-stage `Dockerfile` leveraging Next.js `output: "standalone"`.

### 3.1 Multi-Stage Build Architecture
The `Dockerfile` is structured in three stages:
1. **`deps` stage:** Alpine Linux base, installs build dependencies (`libc6-compat`) and performs clean npm installation (`npm ci`).
2. **`builder` stage:** Generates the Prisma Client (`npx prisma generate`) and compiles the standalone Next.js bundle (`npm run build`).
3. **`runner` stage:** Minimal Alpine runtime containing only the non-root `nextjs` system user, `.next/standalone`, static assets (`.next/static`), and public folder.

### 3.2 Running with Docker Compose
While the repository's root `docker-compose.yml` is configured for local PostgreSQL development, a complete standalone production or VPS stack can be deployed using an orchestrated compose file (e.g., `docker-compose.prod.yml`):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: be_quiz_postgres
    environment:
      POSTGRES_USER: quiz
      POSTGRES_PASSWORD: quiz
      POSTGRES_DB: be_quiz
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  app:
    build: .
    container_name: be_quiz_app
    environment:
      DATABASE_URL: "postgresql://quiz:quiz@postgres:5432/be_quiz?schema=public"
      APP_URL: "http://localhost:3000"
      PORT: 3000
      HOSTNAME: "0.0.0.0"
    ports:
      - "3000:3000"
    volumes:
      # Persistent local storage for flyer and feedback uploads
      - app_uploads:/app/public/uploads
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
  app_uploads:
```

### 3.3 Container Build & Execution Commands
To build and run the container manually:

```bash
# Build the container image
docker build -t be-quiz:latest .

# Run container with volume mount for uploads
docker run -d \
  --name be-quiz \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/db" \
  -e APP_URL="https://quiz.example.com" \
  -v be_quiz_uploads:/app/public/uploads \
  be-quiz:latest
```

---

## 4. Database Schema Sync in Release Pipelines

Regardless of the deployment model, database schema updates must be applied to PostgreSQL:

* **Production & Development Schema Sync:**
  ```bash
  DATABASE_URL="..." npx prisma db push
  ```
  *(Note: The project currently relies on `prisma db push` without checked-in SQL migration folders. Versioned migration history with `prisma migrate dev` / `prisma migrate deploy` can be initialized when needed.)*
* **Initial Admin Seed Data:**
  ```bash
  DATABASE_URL="..." npx tsx prisma/seed.ts
  ```

---

## 5. Capability Flags & Optional Integrations

The application core operates independently without third-party services. Optional features are controlled explicitly via capability environment variables (defaulting to `false` when unset):

| Variable | Values | Purpose | External Dependencies |
| :--- | :--- | :--- | :--- |
| `ENABLE_AI_VISION` | `"true"` \| `"false"` | AI flyer vision scanning & information extraction | `GEMINI_API_KEY` or `OPENAI_API_KEY` |
| `ENABLE_ICAL_EXPORT` | `"true"` \| `"false"` | `.ics` calendar file downloads & personal Google Calendar template links | None |
| `ENABLE_SHARED_GOOGLE_CALENDAR` | `"true"` \| `"false"` | Automated shared team Google Calendar push and sync | `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` |
| `ENABLE_WHATSAPP_SHARE` | `"true"` \| `"false"` | 1-tap WhatsApp lineup and RSVP sharing | None |
| `ENABLE_EMAIL_REGISTRATION` | `"true"` \| `"false"` | Pre-filled email registration mailto buttons | None |

When disabled, corresponding UI buttons and endpoints adapt gracefully (omitted from UI; API endpoints return `501 Not Implemented`). See [Architecture Overview & Capability Registry](../architecture/overview.md#43-capability-registry--modular-features).

---

## 6. Shared Google Calendar Integration Setup Guide

When `ENABLE_SHARED_GOOGLE_CALENDAR="true"` is enabled, the application communicates directly with Google Calendar API v3 using server-side service account credentials.

### 6.1 Google Cloud Platform (GCP) Configuration
1. **Create or Select a GCP Project:** In the [Google Cloud Console](https://console.cloud.google.com/), create a project (e.g., `be-quiz-sync`).
2. **Enable Google Calendar API:** Navigate to **APIs & Services > Library**, search for **Google Calendar API**, and click **Enable**.
3. **Create Service Account:**
   * Go to **IAM & Admin > Service Accounts** and click **Create Service Account**.
   * Name: `be-quiz-calendar-sync` (email will be `be-quiz-calendar-sync@<project-id>.iam.gserviceaccount.com`).
   * No specific GCP project roles are required (calendar permissions are granted in Google Calendar itself).
4. **Generate Service Account Private Key:**
   * Click on the created service account, go to the **Keys** tab, and select **Add Key > Create new key > JSON**.
   * Download the JSON key file securely. You will need `client_email` and `private_key`.

### 6.2 Google Calendar Sharing & Permissions
1. Open [Google Calendar](https://calendar.google.com/) as the owner or manager of the team's shared calendar.
2. In the left sidebar, hover over the calendar, click the three dots (`⋮`), and select **Settings and sharing**.
3. Scroll down to **Share with specific people or groups** and click **Add people and groups**.
4. Paste the Service Account email address (`be-quiz-calendar-sync@<project-id>.iam.gserviceaccount.com`).
5. Set **Permissions** to **"Make changes to events"** (in Dutch: *"Wijzigingen aanbrengen in afspraken"*).
6. Under **Integrate calendar**, copy the **Calendar ID** (e.g., `xyz...@group.calendar.google.com`).

### 6.3 Environment Variables Configuration
Set the following variables in Vercel or your `.env` / container environment:

```env
ENABLE_SHARED_GOOGLE_CALENDAR="true"
GOOGLE_CALENDAR_ID="your-team-calendar-id@group.calendar.google.com"
GOOGLE_SERVICE_ACCOUNT_EMAIL="be-quiz-calendar-sync@<project-id>.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

* **Multiline Private Key Formatting:** The application's native OAuth2 JWT client automatically normalizes literal `\n` character sequences into standard PEM linebreaks. You can safely paste the private key either with literal `\n` in `.env` or as multiline PEM directly into the Vercel Dashboard secret value editor.
* **Database Mapping:** Ensure `npx prisma db push` is run during deployment to provision the `CalendarEventMapping` model in PostgreSQL.

