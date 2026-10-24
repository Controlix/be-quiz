# Pub Quiz Coordination App (BE-Quiz) Implementation Plan — Vertical Slices

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Progressive Web App (PWA) for a private group of quiz friends to coordinate pub quizzes using an outside-in, vertical-slice approach where a clickable working prototype is accessible immediately in Slice 1.

**Architecture:** Next.js 15 (App Router, Tailwind CSS, TypeScript); mutations standardized on Next.js Server Actions in `src/actions/`; progressive enhancement starting from an interactive UI prototype to a fully persisted PostgreSQL database with row-level locks for RSVP concurrency; client-side canvas downscaling + Vision API for flyer OCR; persistent HTTP-only session cookies via invite tokens; standalone multi-stage Docker packaging.

**Tech Stack:** Next.js 15, TypeScript 5, Tailwind CSS, Prisma ORM, PostgreSQL 16 (Docker Compose for local dev), Vitest, Playwright, Anthropic/OpenAI Vision API.

**Spec:** `docs/superpowers/specs/2026-10-24-quiz-coordination-app-design.md`

## Global Constraints

* Language: Dutch (`nl-BE`) for all user-facing UI labels, error messages, and share texts; English for schema, identifiers, and tests.
* Database: PostgreSQL only; zero SQLite references or dependencies.
* Mutations: All client mutations use Next.js Server Actions located in `src/actions/`.
* Access Control: Strictly members-only. Invite tokens stored as SHA-256 hashes; sessions use signed `httpOnly` cookies with 90-day expiry.
* Registration Email: Hand-off via native `mailto:` containing only the team name, quiz title, date/time, and contact person. Never include attendee names or player counts.
* Queue Ordering: Strict FIFO ordered solely by `queuedSince ASC`. Active lineup is the first `maxTeamSize` players; reserves are subsequent players.
* Destructive Confirmation: Client-side confirmation dialogs are mandatory for admin cancel/archive, registration reset, and admin RSVP overrides.

## Review Focus

1. **Vision AI 15s Timeout / 5xx Fallback:** An uploaded flyer where the Vision API times out (>15s) or fails with 5xx cleanly renders the manual entry form with an explanatory Dutch notification banner without throwing an uncaught exception. (Pinned to Task 5)
2. **Admin RSVP Override Audit & Promotion:** An admin decline override records `overriddenById` and `overriddenAt`, promotes the earliest reserve by `queuedSince ASC`, and a subsequent member self-RSVP clears the override audit fields. (Pinned to Task 8)
3. **Lowering `maxTeamSize` Demotion:** Reducing `maxTeamSize` (e.g. from 5 to 4) moves the attendee with the latest `queuedSince` to reserve #1 while strictly preserving their original queue timestamp. (Pinned to Task 8)
4. **PWA Standalone Cookie Isolation Fallback:** An unauthenticated user on `/auth/login` inside an installed standalone PWA can paste an invite token to establish a valid 90-day session. (Pinned to Task 7)
5. **Flyer File Validation:** Upload endpoints reject non-image MIME types or files >4MB with a descriptive Dutch error message. (Pinned to Task 5)

---

## File Structure & Module Responsibilities

```
src/
├── actions/                           # Next.js Server Actions (Mutation standard)
│   ├── rsvpActions.ts                 # RSVP join, decline, and admin override actions
│   ├── quizActions.ts                 # Quiz creation, registration toggle, fee toggle
│   └── adminActions.ts                # Quiz edit/cancel/archive, member invite generation
├── app/
│   ├── layout.tsx                     # Root mobile shell, responsive viewport, fonts
│   ├── page.tsx                       # Redirects to /quizzes
│   ├── quizzes/
│   │   ├── page.tsx                   # Timeline dashboard (In Beraad, Gepland, Archief)
│   │   ├── new/page.tsx               # Flyer upload, vision extraction & manual entry
│   │   └── [id]/
│   │       ├── page.tsx               # Quiz detail view, lineup, RSVP, actions
│   │       └── edit/page.tsx          # Admin quiz editing & cancellation
│   ├── auth/
│   │   ├── login/page.tsx             # Login & manual invite code entry fallback
│   │   ├── join/route.ts              # Invite token claim handler
│   │   └── logout/route.ts            # Clears session cookie and redirects
│   ├── admin/
│   │   ├── members/page.tsx           # Member roster management & invite generation
│   │   └── settings/page.tsx          # Default team name settings
│   └── api/
│       ├── quizzes/
│       │   ├── extract/route.ts       # Vision AI extraction API
│       │   └── [id]/calendar.ics/route.ts # RFC 5545 iCalendar export
├── components/
│   ├── ui/                            # Buttons, Dialogs, Cards, Badges, Tabs
│   ├── TimelineTabs.tsx               # Tab filtering (In Beraad, Gepland, Archief)
│   ├── QuizCard.tsx                   # Mobile card with player count bar and badges
│   ├── TeamLineup.tsx                 # Active lineup & reserve list rendering
│   ├── RsvpControl.tsx                # Attend / Decline toggle with queue feedback
│   ├── ActionToolbar.tsx              # Mailto, WhatsApp, Calendar, and Fee toggle
│   ├── FlyerUploader.tsx              # Camera/file input with client canvas resize
│   └── ConfirmDialog.tsx              # Confirmation modal for destructive actions
├── lib/
│   ├── db.ts                          # Prisma client singleton
│   ├── auth.ts                        # Session cookie hashing & validation
│   ├── crypto.ts                      # SHA-256 token hashing & random token generation
│   ├── storage.ts                     # Local public upload handler for flyer images
│   ├── mailto.ts                      # Formats RFC 6068 mailto URIs for team registration
│   ├── ical.ts                        # RFC 5545 calendar serializer
│   └── whatsapp.ts                    # Formats wa.me share links with encoded Dutch copy
├── services/
│   ├── quizService.ts                 # Atomic quiz + team creation, queries, tab filters
│   ├── rsvpService.ts                 # Row-locked RSVP state transitions & promotion
│   └── visionService.ts               # Vision LLM prompt, validation & rate limiting
└── prisma/
    ├── schema.prisma                  # Full Postgres schema
    └── seed.ts                        # Initial admin and team settings seed
```

---

## Slice 1: Clickable UI Prototype (Immediate Visual Verification)
*Milestone: At the end of Slice 1, you can run `npm run dev`, open the app on your mobile or desktop browser, browse the timeline tabs, click into a quiz, and interact with the RSVP and registration buttons.*

### Task 1: Next.js Shell, Mobile Layout & Timeline Dashboard (Mock)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/quizzes/page.tsx`, `src/components/TimelineTabs.tsx`, `src/components/QuizCard.tsx`, `src/lib/mockData.ts`, `vitest.config.ts`
- Test: `tests/ui/timelineTabs.test.ts`

**Interfaces:**
- Consumes: None (Root setup)
- Produces:
  ```typescript
  export type TabCategory = "IN_BERAAD" | "GEPLAND" | "ARCHIEF";

  export interface MockQuiz {
    id: string;
    title: string;
    startsAt: Date;
    location: string;
    status: "OPEN" | "CANCELLED" | "ARCHIVED";
    team: {
      name: string;
      maxTeamSize: number;
      registeredAt: Date | null;
      paidAt: Date | null;
      rsvps: Array<{ id: string; memberName: string; status: "ATTENDING" | "DECLINED" }>;
    };
  }

  export function categorizeQuizForTabs(quiz: {
    startsAt: Date;
    status: "OPEN" | "CANCELLED" | "ARCHIVED";
    team: { registeredAt: Date | null };
  }): TabCategory;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/timelineTabs.test.ts
import { describe, it, expect } from "vitest";
import { categorizeQuizForTabs } from "../../src/components/TimelineTabs";

describe("Timeline Tab Classification", () => {
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 86400000);

  it("classifies upcoming unregistered as In Beraad", () => {
    expect(categorizeQuizForTabs({ startsAt: future, status: "OPEN", team: { registeredAt: null } })).toBe("IN_BERAAD");
  });

  it("classifies upcoming registered as Gepland", () => {
    expect(categorizeQuizForTabs({ startsAt: future, status: "OPEN", team: { registeredAt: new Date() } })).toBe("GEPLAND");
  });

  it("classifies past or cancelled as Archief", () => {
    expect(categorizeQuizForTabs({ startsAt: past, status: "OPEN", team: { registeredAt: new Date() } })).toBe("ARCHIEF");
    expect(categorizeQuizForTabs({ startsAt: future, status: "CANCELLED", team: { registeredAt: null } })).toBe("ARCHIEF");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/timelineTabs.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement mobile layout, TimelineTabs, QuizCard, and mock dashboard**

Initialize Next.js App Router with Tailwind CSS; configure mobile viewport container in `src/app/layout.tsx`; build `src/components/TimelineTabs.tsx` and `src/components/QuizCard.tsx`; populate `src/lib/mockData.ts` with 3 realistic quizzes; assemble `src/app/quizzes/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/timelineTabs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.ts tailwind.config.ts src/ vitest.config.ts tests/ui/timelineTabs.test.ts
git commit -m "feat(slice1): implement mobile layout and interactive timeline dashboard"
```

---

### Task 2: Interactive Quiz Detail View & Mock RSVP Experience

**Files:**
- Create: `src/app/quizzes/[id]/page.tsx`, `src/components/TeamLineup.tsx`, `src/components/RsvpControl.tsx`, `src/components/ActionToolbar.tsx`
- Test: `tests/ui/quizDetail.test.ts`

**Interfaces:**
- Consumes: `MockQuiz` from `src/lib/mockData.ts`
- Produces:
  ```typescript
  export interface LineupMember {
    id: string;
    name: string;
    queuedSince: Date;
  }

  export function formatReserveBadge(index: number): string; // "Reserve #1", "Reserve #2"

  export function partitionLineup(
    attendees: LineupMember[],
    maxTeamSize: number
  ): { active: LineupMember[]; reserves: LineupMember[] };
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/quizDetail.test.ts
import { describe, it, expect } from "vitest";
import { formatReserveBadge, partitionLineup } from "../../src/components/TeamLineup";

describe("Team Lineup Rendering & Partitioning", () => {
  it("formats reserve queue badges correctly", () => {
    expect(formatReserveBadge(0)).toBe("Reserve #1");
    expect(formatReserveBadge(1)).toBe("Reserve #2");
  });

  it("partitions attendees strictly into active and reserves by maxTeamSize", () => {
    const attendees = [
      { id: "1", name: "Marc", queuedSince: new Date(1000) },
      { id: "2", name: "Sarah", queuedSince: new Date(2000) },
      { id: "3", name: "Tom", queuedSince: new Date(3000) },
      { id: "4", name: "Elena", queuedSince: new Date(4000) },
      { id: "5", name: "Thomas", queuedSince: new Date(5000) },
    ];
    const { active, reserves } = partitionLineup(attendees, 4);
    expect(active.length).toBe(4);
    expect(reserves.length).toBe(1);
    expect(reserves[0].name).toBe("Thomas");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/quizDetail.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement TeamLineup, RsvpControl, ActionToolbar, and Detail Page**

Build `TeamLineup.tsx` displaying confirmed players and reserve badges; build `RsvpControl.tsx` allowing you to click "Ik doe mee" and observe the 4-player cap and reserve list shift in local React state; build `ActionToolbar.tsx` displaying mailto, WhatsApp, and fee buttons; assemble `src/app/quizzes/[id]/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/quizDetail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/quizzes/[id]/page.tsx src/components/TeamLineup.tsx src/components/RsvpControl.tsx src/components/ActionToolbar.tsx tests/ui/quizDetail.test.ts
git commit -m "feat(slice1): complete clickable quiz detail view and interactive rsvp prototype"
```

---

## Slice 2: Persistence & Real Concurrency-Locked State
*Milestone: Replace mock data with PostgreSQL and Prisma; RSVPs and quizzes persist across devices, and concurrent RSVPs are locked at the database row level.*

### Task 3: PostgreSQL Docker, Environment Setup & Prisma Schema Setup

**Files:**
- Create: `docker-compose.yml`, `.env`, `.env.example`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: None (Database bootstrapping)
- Produces:
  ```typescript
  import { PrismaClient } from "@prisma/client";
  export const prisma: PrismaClient;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/db/schema.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";

describe("Database Connection & Models", () => {
  it("queries the team settings singleton from postgres", async () => {
    const setting = await prisma.teamSetting.findUnique({ where: { id: "singleton" } });
    expect(setting?.defaultTeamName).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL

- [ ] **Step 3: Configure Docker Compose, `.env`, Prisma schema, and seed**

Configure `docker-compose.yml` with PostgreSQL 16 on port 5432; create `.env` and `.env.example` with `DATABASE_URL="postgresql://quiz:quiz@localhost:5432/be_quiz?schema=public"`; define the complete Prisma schema from §6.1 of the design doc with `linux-musl-openssl-3.0.x` binary targets; implement `prisma/seed.ts` seeding members and the `singleton` TeamSetting row; initialize `src/lib/db.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker-compose up -d && npx prisma migrate reset --force && npx vitest run tests/db/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example prisma/ src/lib/db.ts tests/db/schema.test.ts
git commit -m "feat(slice2): configure postgres docker container, env, and prisma models"
```

---

### Task 4: Concurrency-Locked RSVP Engine & Server Actions

**Files:**
- Create: `src/services/quizService.ts`, `src/services/rsvpService.ts`, `src/actions/rsvpActions.ts`, `src/actions/quizActions.ts`
- Modify: `src/app/quizzes/page.tsx`, `src/app/quizzes/[id]/page.tsx`
- Test: `tests/services/rsvpConcurrency.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/db.ts`
- Produces:
  ```typescript
  export interface CreateQuizInput {
    title: string;
    startsAt: Date;
    timeZone?: string;
    durationMinutes?: number;
    location: string;
    maxTeamSize: number;
    organizerEmail?: string;
    registrationUrl?: string;
    entryFee?: string;
    notes?: string;
    flyerImageUrl?: string;
  }

  export function createQuiz(data: CreateQuizInput, creatorId: string): Promise<Quiz & { team: Team }>;
  export function getRsvpLineup(teamId: string): Promise<{ active: RsvpWithMember[]; reserves: RsvpWithMember[] }>;
  export function setRsvp(teamId: string, memberId: string, status: "ATTENDING" | "DECLINED"): Promise<void>;

  // Server Actions in src/actions/
  export async function joinQuizRsvpAction(teamId: string): Promise<{ success: boolean; error?: string }>;
  export async function declineQuizRsvpAction(teamId: string): Promise<{ success: boolean; error?: string }>;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/services/rsvpConcurrency.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup } from "../../src/services/rsvpService";

describe("RSVP Concurrency & FIFO Waitlist", () => {
  it("enforces FIFO queue and handles concurrent RSVPs at capacity limit", async () => {
    const admin = await prisma.member.create({ data: { name: "Admin", role: "ADMIN" } });
    const quiz = await createQuiz({
      title: "Concurrency Quiz",
      startsAt: new Date(Date.now() + 86400000),
      location: "Gent",
      maxTeamSize: 2,
    }, admin.id);

    const m1 = await prisma.member.create({ data: { name: "Player 1" } });
    const m2 = await prisma.member.create({ data: { name: "Player 2" } });
    const m3 = await prisma.member.create({ data: { name: "Player 3" } });

    await Promise.all([
      setRsvp(quiz.team!.id, m1.id, "ATTENDING"),
      setRsvp(quiz.team!.id, m2.id, "ATTENDING"),
      setRsvp(quiz.team!.id, m3.id, "ATTENDING"),
    ]);

    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(2);
    expect(reserves.length).toBe(1);

    await setRsvp(quiz.team!.id, active[0].memberId, "DECLINED");
    const updated = await getRsvpLineup(quiz.team!.id);
    expect(updated.active.length).toBe(2);
    expect(updated.reserves.length).toBe(0);
    expect(updated.active.map(a => a.memberId)).toContain(reserves[0].memberId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/rsvpConcurrency.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `quizService.ts`, `rsvpService.ts`, Server Actions, and wire to UI**

Implement atomic quiz and team creation in `quizService.ts`; wrap RSVP changes in transactions locking the team row (`SELECT * FROM "Team" WHERE id = $1 FOR UPDATE`) in `rsvpService.ts`; implement Server Actions in `src/actions/rsvpActions.ts` and `src/actions/quizActions.ts`; wire Server Actions to `src/app/quizzes/page.tsx` and `src/app/quizzes/[id]/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/rsvpConcurrency.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ src/actions/ src/app/quizzes/ tests/services/rsvpConcurrency.test.ts
git commit -m "feat(slice2): wire live database queries, server actions, and row-locked rsvp engine"
```

---

## Slice 3: Flyer Scanner, Vision AI & External Actions
*Milestone: Connect phone camera photo intake with Vision AI extraction, plus one-tap email registration, calendar exports, and WhatsApp sharing.*

### Task 5: Flyer Intake, Local Storage Adapter & Vision Extraction Route

**Files:**
- Create: `src/lib/storage.ts`, `src/components/FlyerUploader.tsx`, `src/services/visionService.ts`, `src/app/api/quizzes/extract/route.ts`, `src/app/quizzes/new/page.tsx`, `src/components/QuizEntryForm.tsx`
- Test: `tests/services/visionService.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  ```typescript
  export interface VisionExtractionResult {
    isValid: boolean;
    missingFields: string[];
    data: {
      title?: string;
      date?: string;
      time?: string;
      location?: string;
      maxTeamSize?: number;
      organizerEmail?: string;
      registrationUrl?: string;
      entryFee?: string;
    };
    error?: string;
  }

  export function parseVisionExtractionResponse(rawJson: string): VisionExtractionResult;
  export function saveUploadedFlyer(file: Buffer, mimeType: string): Promise<string>; // returns public path e.g. "/uploads/xyz.jpg"
  ```

- [ ] **Step 1: Write the failing test (including Review Focus failure modes)**

```typescript
// tests/services/visionService.test.ts
import { describe, it, expect } from "vitest";
import { parseVisionExtractionResponse } from "../../src/services/visionService";

describe("Vision Extraction Validation & Error Handling", () => {
  it("flags missing location or maxTeamSize as invalid", () => {
    const rawAiOutput = JSON.stringify({
      title: "Café Quiz",
      date: "2026-11-20",
      time: "20:00",
      location: null,
      maxTeamSize: null,
      organizerEmail: "info@cafe.be",
    });
    const result = parseVisionExtractionResponse(rawAiOutput);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain("location");
    expect(result.missingFields).toContain("maxTeamSize");
  });

  // Review Focus #1: Vision AI 15s Timeout / 5xx Fallback
  it("handles provider timeout or 5xx gracefully without throwing", () => {
    const timeoutResult = parseVisionExtractionResponse("TIMEOUT");
    expect(timeoutResult.isValid).toBe(false);
    expect(timeoutResult.error).toContain("time-out");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/visionService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `storage.ts`, `FlyerUploader.tsx`, `visionService.ts`, route, and `QuizEntryForm.tsx`**

Implement local file storage in `src/lib/storage.ts` saving images to `public/uploads/`; build client canvas downscaling in `FlyerUploader.tsx`; implement structured LLM prompt with 15s timeout and fallback in `visionService.ts`; build `/api/quizzes/extract/route.ts` validating MIME (`image/jpeg`, `image/png`, `image/webp`) and size (<=4MB); assemble `/quizzes/new/page.tsx` with Dutch banner on extraction failure.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/visionService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/components/FlyerUploader.tsx src/services/visionService.ts src/app/api/quizzes/extract/ src/app/quizzes/new/ src/components/QuizEntryForm.tsx tests/services/visionService.test.ts
git commit -m "feat(slice3): implement flyer scanner, vision ai parsing, and quiz entry form"
```

---

### Task 6: Native Mailto Hand-off, Calendar Export & WhatsApp Sharing

**Files:**
- Create: `src/lib/mailto.ts`, `src/lib/ical.ts`, `src/lib/whatsapp.ts`, `src/services/registrationService.ts`, `src/services/paymentService.ts`, `src/actions/registrationActions.ts`, `src/app/api/quizzes/[id]/calendar.ics/route.ts`
- Modify: `src/components/ActionToolbar.tsx`
- Test: `tests/lib/integrations.test.ts`

**Interfaces:**
- Consumes: `Quiz`, `Team` types from `@prisma/client`
- Produces:
  ```typescript
  export function generateRegistrationMailto(
    quiz: { title: string; startsAt: Date; organizerEmail: string | null },
    team: { name: string },
    contactName: string
  ): string;

  export function generateIcsCalendar(
    quiz: { id: string; title: string; startsAt: Date; durationMinutes: number; location: string },
    team: { name: string; paidAt: Date | null }
  ): string;

  export function generateGoogleCalendarUrl(
    quiz: { title: string; startsAt: Date; durationMinutes: number; location: string },
    team: { name: string; paidAt: Date | null }
  ): string;

  export function generateWhatsAppShareUrl(
    quiz: { title: string; startsAt: Date; location: string },
    team: { name: string },
    appUrl: string
  ): string;

  // Server Actions
  export async function setRegisteredAction(teamId: string): Promise<{ success: boolean }>;
  export async function toggleFeePaidAction(teamId: string): Promise<{ success: boolean }>;
  ```

- [ ] **Step 1: Write the failing test (including Review Focus #5)**

```typescript
// tests/lib/integrations.test.ts
import { describe, it, expect } from "vitest";
import { generateRegistrationMailto } from "../../src/lib/mailto";
import { generateIcsCalendar } from "../../src/lib/ical";

describe("Mailto & Calendar Integrations", () => {
  // Review Focus #5: Zero-RSVP registration email has no player names or counts
  it("generates mailto with team name only, excluding attendee names and player counts", () => {
    const quiz = { title: "Herfstquiz", startsAt: new Date("2026-11-14T19:00:00Z"), organizerEmail: "org@quiz.be" };
    const team = { name: "De Quizvrienden" };
    const url = generateRegistrationMailto(quiz, team, "Marc");
    expect(url.startsWith("mailto:org@quiz.be?")).toBe(true);
    expect(url).toContain("De%20Quizvrienden");
    expect(url).not.toContain("Spelers");
    expect(url).not.toContain("Aantal");
  });

  it("produces RFC 5545 compliant calendar output with CRLF endings", () => {
    const quiz = { id: "q1", title: "Test Quiz", startsAt: new Date("2026-11-14T19:00:00Z"), durationMinutes: 180, location: "Gent" };
    const team = { name: "Ploeg 1", paidAt: new Date() };
    const ics = generateIcsCalendar(quiz, team);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/integrations.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement mailto, ical, whatsapp helpers, actions, and wire ActionToolbar**

Implement `src/lib/mailto.ts` using `encodeURIComponent` with `%0D%0A` newlines; implement `src/lib/ical.ts` and `src/lib/whatsapp.ts`; build Server Actions in `src/actions/registrationActions.ts`; serve `.ics` at `/api/quizzes/[id]/calendar.ics`; connect live actions into `ActionToolbar.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/integrations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mailto.ts src/lib/ical.ts src/lib/whatsapp.ts src/services/registrationService.ts src/services/paymentService.ts src/actions/registrationActions.ts src/app/api/quizzes/[id]/calendar.ics/ src/components/ActionToolbar.tsx tests/lib/integrations.test.ts
git commit -m "feat(slice3): implement mailto hand-off, ical export, whatsapp share, and payment toggle"
```

---

## Slice 4: Authentication, Admin Controls, PWA & Packaging
*Milestone: Secure the application with invite links, session cookies, admin tools, PWA home-screen support, and multi-stage Dockerfile.*

### Task 7: Authentication, Sessions & Middleware Route Gating

**Files:**
- Create: `src/lib/crypto.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/app/auth/login/page.tsx`, `src/app/auth/join/route.ts`, `src/app/auth/logout/route.ts`
- Test: `tests/auth/authFlow.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/db.ts`
- Produces:
  ```typescript
  export function hashToken(token: string): string;
  export function generateSecureToken(): string;
  export function createSession(memberId: string): Promise<{ token: string; expiresAt: Date }>;
  export function validateSession(token: string): Promise<{ member: Member } | null>;
  export function getSessionMember(): Promise<Member | null>; // Read from Next.js cookies()
  ```

- [ ] **Step 1: Write the failing test (including Review Focus #4)**

```typescript
// tests/auth/authFlow.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { hashToken } from "../../src/lib/crypto";
import { createSession, validateSession } from "../../src/lib/auth";

describe("Invite & Session Flow", () => {
  it("claims an invite token and verifies the generated session", async () => {
    const member = await prisma.member.create({ data: { name: "Friend", role: "USER" } });
    const rawToken = "invite-secret-uuid";
    await prisma.invite.create({ data: { memberId: member.id, tokenHash: hashToken(rawToken) } });

    const { token } = await createSession(member.id);
    const session = await validateSession(token);
    expect(session?.member.name).toBe("Friend");
  });

  // Review Focus #4: PWA Standalone Cookie Isolation Fallback
  it("validates manual token paste on login page", async () => {
    const member = await prisma.member.create({ data: { name: "PWA User" } });
    const rawToken = "pwa-secret-uuid";
    await prisma.invite.create({ data: { memberId: member.id, tokenHash: hashToken(rawToken) } });

    const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    expect(invite).not.toBeNull();
    expect(invite?.usedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/authFlow.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement crypto, session handling, auth routes, and Next.js middleware**

Implement SHA-256 token hashing in `src/lib/crypto.ts`; implement session creation (90-day expiry) in `src/lib/auth.ts`; implement `src/middleware.ts` gating all routes except `/auth/*` and static assets; build `/auth/login/page.tsx` with manual invite code input field; implement `/auth/join/route.ts` and `/auth/logout/route.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/authFlow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts src/lib/auth.ts src/middleware.ts src/app/auth/ tests/auth/authFlow.test.ts
git commit -m "feat(slice4): implement invite token claim, session middleware, and login fallback"
```

---

### Task 8: Admin Controls, Confirmation Guards & Audit Trails

**Files:**
- Create: `src/components/ConfirmDialog.tsx`, `src/actions/adminActions.ts`, `src/app/quizzes/[id]/edit/page.tsx`, `src/app/admin/members/page.tsx`, `src/app/admin/settings/page.tsx`
- Modify: `src/services/rsvpService.ts`
- Test: `tests/admin/adminActions.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAdmin`
- Produces:
  ```typescript
  export async function adminCancelQuizAction(quizId: string): Promise<{ success: boolean }>;
  export async function adminResetRegistrationAction(teamId: string): Promise<{ success: boolean }>;
  export async function adminOverrideDeclineAction(teamId: string, memberId: string): Promise<{ success: boolean }>;
  export async function adminUpdateTeamCapacityAction(teamId: string, newMaxTeamSize: number): Promise<{ success: boolean }>;
  export async function adminAddMemberAction(name: string): Promise<{ inviteUrl: string }>;
  export async function adminUpdateDefaultTeamNameAction(newName: string): Promise<{ success: boolean }>;
  ```

- [ ] **Step 1: Write the failing test (including Review Focus #2 & #3)**

```typescript
// tests/admin/adminActions.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup, adminOverrideDecline, updateTeamCapacity } from "../../src/services/rsvpService";

describe("Admin Override & Capacity Demotion Logic", () => {
  // Review Focus #2: Admin RSVP Override Audit & Promotion
  it("audits admin decline overrides and promotes the earliest reserve", async () => {
    const admin = await prisma.member.create({ data: { name: "Admin", role: "ADMIN" } });
    const quiz = await createQuiz({ title: "Admin Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 1 }, admin.id);
    const m1 = await prisma.member.create({ data: { name: "Player 1" } });
    const m2 = await prisma.member.create({ data: { name: "Player 2" } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "ATTENDING");

    await adminOverrideDecline(quiz.team!.id, m1.id, admin.id);
    const rsvp1 = await prisma.rsvp.findUnique({ where: { teamId_memberId: { teamId: quiz.team!.id, memberId: m1.id } } });
    expect(rsvp1?.status).toBe("DECLINED");
    expect(rsvp1?.overriddenById).toBe(admin.id);
    expect(rsvp1?.overriddenAt).not.toBeNull();

    const { active } = await getRsvpLineup(quiz.team!.id);
    expect(active[0].memberId).toBe(m2.id);
  });

  // Review Focus #3: Lowering maxTeamSize Demotion
  it("demotes latest attendee to reserve #1 while preserving queuedSince when maxTeamSize is reduced", async () => {
    const admin = await prisma.member.create({ data: { name: "Admin2", role: "ADMIN" } });
    const quiz = await createQuiz({ title: "Capacity Quiz", startsAt: new Date(Date.now() + 86400000), location: "Gent", maxTeamSize: 2 }, admin.id);
    const m1 = await prisma.member.create({ data: { name: "Player A" } });
    const m2 = await prisma.member.create({ data: { name: "Player B" } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "ATTENDING");

    await updateTeamCapacity(quiz.team!.id, 1);
    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(1);
    expect(active[0].memberId).toBe(m1.id);
    expect(reserves.length).toBe(1);
    expect(reserves[0].memberId).toBe(m2.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin/adminActions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `ConfirmDialog.tsx`, admin Server Actions, and admin pages**

Build `ConfirmDialog.tsx` for client-side confirmation dialogs; implement `adminOverrideDecline` and `updateTeamCapacity` in `src/services/rsvpService.ts`; implement Server Actions in `src/actions/adminActions.ts`; build `/quizzes/[id]/edit/page.tsx`, `/admin/members/page.tsx`, and `/admin/settings/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin/adminActions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfirmDialog.tsx src/services/rsvpService.ts src/actions/adminActions.ts src/app/quizzes/[id]/edit/ src/app/admin/ tests/admin/adminActions.test.ts
git commit -m "feat(slice4): implement admin controls, confirmation dialogs, and rsvp override audit"
```

---

### Task 9: PWA Manifest, Standalone Dockerfile & Acceptance Test Suite

**Files:**
- Create: `public/manifest.json`, `public/icon-192.png`, `public/icon-512.png`, `Dockerfile`, `.dockerignore`, `tests/e2e/acceptance.test.ts`
- Modify: `src/app/layout.tsx`, `next.config.ts`
- Test: `tests/e2e/acceptance.test.ts`

**Interfaces:**
- Consumes: All application modules
- Produces:
  - Valid PWA manifest for mobile standalone installation.
  - Multi-stage Alpine `Dockerfile` running Next.js standalone server with `linux-musl-openssl-3.0.x`.
  - Comprehensive acceptance test suite testing all 9 criteria from Section 9 of the design spec.

- [ ] **Step 1: Write the failing acceptance test**

```typescript
// tests/e2e/acceptance.test.ts
import { describe, it, expect } from "vitest";
import manifest from "../../public/manifest.json";

describe("Acceptance & PWA Suite", () => {
  it("verifies PWA manifest configuration for mobile standalone installation", () => {
    expect(manifest.name).toBe("KwisVrienden");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/e2e/acceptance.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement PWA assets, standalone Dockerfile, and complete acceptance suite**

Create `public/manifest.json` and mobile icons; configure `output: "standalone"` in `next.config.ts`; build multi-stage `Dockerfile` (Alpine Node 20, Prisma generate, Next.js build, lean runner); implement `tests/e2e/acceptance.test.ts` verifying the 9 acceptance criteria against PostgreSQL.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/e2e/acceptance.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/ Dockerfile .dockerignore next.config.ts src/app/layout.tsx tests/e2e/acceptance.test.ts
git commit -m "feat(slice4): add pwa manifest, standalone dockerfile, and full acceptance test suite"
```
