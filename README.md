# BE-Quiz (Ben in Black) 🏆

A modern, mobile-first pub quiz coordination web application built for Belgian quiz teams.

BE-Quiz replaces messy WhatsApp threads, forgotten calendar invites, and scattered emails with a single integrated flow: scan flyers with AI, gather RSVPs, manage active lineups and reserves, coordinate registration, and export to calendars.

---

## 🌟 Key Features

* **📱 Mobile-First Player Experience:**
  * Clean, thumb-friendly dashboard showing upcoming, pending, and past quizzes.
  * 1-tap RSVP: *"Ik doe mee"* or *"Ik pas"*.
  * Automatic active lineup vs. reserve list tracking based on maximum team capacity.
  * Drag-and-drop participant reordering for admins with touch support.

* **🤖 AI Flyer Scanning (Vision OCR):**
  * Upload, drag-and-drop, paste from clipboard (`Ctrl+V` / `Cmd+V`), or snap a photo of a quiz poster.
  * Automatically extracts title, date, time (European 24-hour format), venue/location, team capacity, and structured entry fee via Google Gemini or OpenAI Vision.

* **💬 WhatsApp & Email Integration:**
  * One-tap WhatsApp sharing with formatted quiz details, location, and deep links.
  * One-tap registration email generator (`mailto:`) pre-filled with team name (*Ben in Black*), roster lineup, and organizer contact details.
  * Direct payment tracking to record who prepaid the registration fee.

* **📅 Native Calendar Integration:**
  * 1-click `.ics` calendar event export compatible with Apple Calendar, Google Calendar, and Outlook.

* **🔐 Frictionless PIN Authentication:**
  * Name picker + 4-digit personal PIN authentication with rolling 90-day sessions.
  * One-click invite links for onboarding new team members.
  * Admin PIN reset capability from the member roster.

* **💡 In-App Feedback & Bug Reporting:**
  * Built-in mobile widget to submit bugs, ideas, or remarks with optional screenshot capture (via `html2canvas-pro`).
  * Dedicated desktop admin back-office view (`/admin/feedback`) to inspect feedback, device metadata, and attached images.

---

## 🛠 Tech Stack

* **Framework:** [Next.js](https://nextjs.org/) (App Router, Server Components, Server Actions)
* **Frontend:** [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
* **Database & ORM:** PostgreSQL, [Prisma ORM](https://www.prisma.io/)
* **AI Vision OCR:** Google Generative AI (Gemini) / OpenAI API
* **File Storage:** [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (production) / local disk storage (development fallback)
* **Testing:** [Vitest](https://vitest.dev/)

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: v20 or higher
* **npm**: v10 or higher
* **Docker**: (optional, for running local PostgreSQL)

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd be-quiz
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Configure your `.env` variables:

```env
# Database
DATABASE_URL="postgresql://quiz:quiz@localhost:5432/be_quiz?schema=public"

# App URL (used for invites, calendar URLs, and WhatsApp deep links)
APP_URL="http://localhost:3000"

# Optional: AI Flyer Extraction (choose Gemini or OpenAI)
GEMINI_API_KEY="your-gemini-api-key"
# or
OPENAI_API_KEY="your-openai-api-key"

# Optional: Cloud Image Storage (if omitted, falls back to public/uploads locally)
# BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

### 3. Start Local Database

You can run PostgreSQL locally using Docker Compose:

```bash
docker compose up -d
```

### 4. Push Schema & Seed Database

```bash
npx prisma db push
npx prisma db seed
```

> **Note on Seeding:** The seed sets up the initial admin account for **Marc** (Admin) with the default team name **Ben in Black**.

### 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests

The test suite runs with **Vitest**:

```bash
npm test
```

To run tests in watch mode:

```bash
npx vitest
```

---

## 🚢 Deployment

BE-Quiz is optimized for deployment on **Vercel** with a managed PostgreSQL instance (Neon / Prisma Postgres) and Vercel Blob storage.

For detailed production setup instructions, refer to [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 📄 License

ISC License.
