# Deployment Guide: KwisVrienden on Vercel

This guide outlines the step-by-step procedure to deploy and configure this application on **Vercel** with a managed PostgreSQL database and Vercel Blob storage.

For detailed compute models (including Docker standalone containers), see [docs/deployment/overview.md](docs/deployment/overview.md).  
For backing services, database pooling, and dual-mode storage, see [docs/infrastructure/overview.md](docs/infrastructure/overview.md).  
For the software service boundaries, see [docs/architecture/overview.md](docs/architecture/overview.md).

---

## Architecture Overview

* **Frontend & Backend**: Next.js (App Router, Server Actions, Server Components) hosted on Vercel Serverless.
* **Database**: Managed PostgreSQL (Prisma Postgres or Neon) managed via Prisma ORM.
* **Asset Storage**: Vercel Blob for storing flyer images and feedback screenshots.

---

## Prerequisites

1. A **[GitHub](https://github.com)** account.
2. A **[Vercel](https://vercel.com)** account (connected to GitHub).
3. Local environment: Node.js (v20+ recommended), npm, and Git.

---

## Step 1: Push Code to GitHub

1. Create a new empty repository on GitHub (e.g., `be-quiz`) without initializing a README, `.gitignore`, or license.
2. In your local terminal, add the remote and push the `main` branch:
   ```bash
   git remote add origin git@github.com:YOUR_GITHUB_USERNAME/be-quiz.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Import into Vercel

1. Navigate to **[vercel.com/new](https://vercel.com/new)**.
2. Under **Import Git Repository**, find your repository and click **Import**.
3. Leave all default project settings (Next.js is detected automatically).
4. If prompted with optional integrations, you can proceed directly or click **Deploy**.

---

## Step 3: Add PostgreSQL Database

1. In your Vercel project dashboard, navigate to the **Storage** tab.
2. Click **Create Database** (or **Connect Database**).
3. Select **Prisma Postgres** (or **Postgres / Neon**).
4. When configuring the integration:
   * **Project**: Select `be-quiz`.
   * **Custom Prefix**: Enter `DATABASE` (so it creates `DATABASE_URL`).
   * Complete the setup.

---

## Step 4: Add Image Storage (Vercel Blob)

1. In the same **Storage** tab, click **Create Storage**.
2. Select **Blob**.
3. In the configuration dialog:
   * **Access**: Select **Public** *(required for flyer and screenshot images)*.
   * **Read-write token**: **Check** the box next to *"Add a read-write token env var to this connection"*.
4. Click **Create**. This automatically injects `BLOB_READ_WRITE_TOKEN`.

---

## Step 5: Initialize the Database (Push Schema & Seed Admin)

Vercel provides the database, but the tables must be created and the initial administrator seeded:

1. Obtain your connection URL from Vercel:
   * Go to **Settings** → **Environment Variables**, or open your database in the **Storage** tab.
   * Copy the `DATABASE_URL` string (e.g. `postgres://...` or `DATABASE_POSTGRES_URL`).
2. Run the schema sync from your local terminal:
   ```bash
   DATABASE_URL="your-connection-string-here" npx prisma db push
   ```
3. Run the initial seed script to create the initial admin user (**Marc**):
   ```bash
   DATABASE_URL="your-connection-string-here" npx tsx prisma/seed.ts
   ```

---

## Step 6: Configure Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and verify/add the following:

### Core Required Variables
| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (auto-created in Step 3). |
| `BLOB_READ_WRITE_TOKEN` | **Yes** | Token for flyer and feedback uploads (auto-created in Step 4). |
| `APP_URL` | **Yes** | Your live production URL (e.g. `https://your-project.vercel.app`), needed for invite links, calendar sync, and webhooks. |

### Optional Modular Capabilities (Default: `false` when unset)
The core application functions with zero external API dependencies. Enable features as desired:

| Variable | Values | Purpose & Requirements |
| :--- | :--- | :--- |
| `ENABLE_SHARED_GOOGLE_CALENDAR` | `"true"` \| `"false"` | Pushes officially registered quizzes to a shared team Google Calendar. Requires Google Cloud Service Account credentials (see [Step 7](#step-7-optional-configure-shared-team-google-calendar)). |
| `ENABLE_AI_VISION` | `"true"` \| `"false"` | AI flyer vision scanning & data extraction. Requires `GEMINI_API_KEY` or `OPENAI_API_KEY`. |
| `ENABLE_ICAL_EXPORT` | `"true"` \| `"false"` | Enables personal `.ics` downloads & individual "Add to Google Calendar" links. |
| `ENABLE_WHATSAPP_SHARE` | `"true"` \| `"false"` | Enables 1-tap WhatsApp lineup and RSVP sharing buttons. |
| `ENABLE_EMAIL_REGISTRATION` | `"true"` \| `"false"` | Enables pre-filled email registration mailto actions. |

---

## Step 7: (Optional) Configure Shared Team Google Calendar

To automatically sync registered quizzes to your team's shared Google Calendar:

1. **Google Cloud Console:**
   * Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the **Google Calendar API**.
   * Navigate to **IAM & Admin > Service Accounts** and create a Service Account (e.g., `be-quiz-sync@<project-id>.iam.gserviceaccount.com`).
   * Under the service account's **Keys** tab, select **Add Key > Create new key > JSON** and download the file.
2. **Share Google Calendar:**
   * Open [Google Calendar](https://calendar.google.com/), hover over your team's calendar, click `⋮` > **Settings and sharing**.
   * Under **Share with specific people or groups**, add the Service Account email.
   * Set Permission to: **"Make changes to events"** (*"Wijzigingen aanbrengen in afspraken"*).
   * Copy the **Calendar ID** (under *Integrate calendar*, e.g., `xyz...@group.calendar.google.com`).
3. **Add Vercel Environment Variables:**
   * `ENABLE_SHARED_GOOGLE_CALENDAR`: `"true"`
   * `GOOGLE_CALENDAR_ID`: Your calendar ID from step 2.
   * `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The `client_email` from your downloaded JSON.
   * `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: The `private_key` from your downloaded JSON. Paste either directly as multiline PEM into the Vercel Dashboard secret field or with escaped `\n` characters (the app automatically normalizes line endings).

---

## Step 8: Trigger a Production Redeploy

Whenever environment variables or storage connections are added:

### Via Vercel Dashboard:
* Go to the **Deployments** tab.
* Click the three dots `...` on the latest deployment and click **Redeploy**.

### Via Vercel CLI (Terminal):
```bash
npx vercel deploy --prod
```

---

## Routine Operations & Maintenance

### Update Database Schema
When you modify `prisma/schema.prisma`:
```bash
# Preview changes locally or push directly to production database:
DATABASE_URL="your-production-url" npx prisma db push
```

### Inspect Database Data
To view or edit database records with a browser UI:
```bash
DATABASE_URL="your-production-url" npx prisma studio
```

### Pull Remote Environment Variables Locally
To pull production environment variables to a local `.env.local` file:
```bash
npx vercel env pull .env.local --environment=production
```
