# ADR 0006: Multi-Team Deployment Strategy

**Date:** 2026-11-06  
**Status:** Proposed  
**Deciders:** Marc, Core Engineering Team

---

## Context & Problem Statement

The application is currently designed and operated as a single-team coordination system. The database stores members, sessions, quizzes, rosters, and a singleton `TeamSetting` (`Ben in Black`). Authentication uses session cookies tied to the `Session` and `Member` tables, seeded with an initial administrator account.

There is now a requirement to support a second quiz team. The requirements specify:

1. **Strict data isolation:** The second team must have their own database and storage assets so that quizzes, RSVPs, member rosters, invite links, and payments do not intermingle.
2. **Unified administrative stewardship:** The product owner / administrator needs full administrative capabilities on both instances.
3. **Operational simplicity:** Minimize code changes, runtime complexity, and security surface area.

## Decision Drivers

- **Zero Cross-Team Leakage:** Quizzes, rosters, invite tokens, member names, and financial payment markers must remain completely isolated.
- **Architectural Simplicity & Maintainability:** Minimize invasiveness to existing Prisma schemas, server actions, client components, and security models.
- **Admin Capability:** The administrator must be able to manage both teams without complicated configuration.
- **Low Operational & Hosting Overhead:** Leverage existing serverless hosting (Vercel) and database tiers (Neon / Prisma Postgres) without introducing complex orchestration or cluster overhead.

## Considered Options

1. **Option 1: Dedicated Second Vercel Deployment + Independent Database (Preferred / Proposed)**
   - Connect the existing GitHub repository (`be-quiz`) to a second Vercel project (e.g., `quiz-team2.vercel.app` or a custom domain).
   - Provision a dedicated PostgreSQL database instance (Neon / Prisma Postgres) and separate storage token (`BLOB_READ_WRITE_TOKEN`).
   - Run the standard schema sync (`prisma db push`) and seed the administrator (`prisma/seed.ts`) in the new database.
   - _Pros:_
     - **Zero code changes:** No alterations required in Prisma models, server actions, or UI components.
     - **Strict physical data isolation:** Independent databases, connection strings, backups, and storage tokens. If one team resets or clears data, the other is unaffected.
     - **Automated continuous deployment:** Git pushes to `main` automatically deploy bug fixes and new features to both instances in parallel.
     - **Independent configuration:** Teams can customize capability flags (e.g. Google Calendar sync, AI vision) independently.
     - **Zero cost penalty:** Fits comfortably within free/starter tiers of Vercel and serverless PostgreSQL.
   - _Cons:_
     - Requires managing two application URLs/bookmarks and logging in separately on each domain.

2. **Option 2: Independent Deployments with Cross-Domain Admin SSO or Admin Portal Hub**
   - Retain physically isolated databases and deployments, but implement a shared authentication broker, OAuth/OIDC provider, or centralized administrative dashboard that queries both databases.
   - _Pros:_
     - Retains physical database isolation while providing single-click admin switching or a single login token.
   - _Cons:_
     - Requires substantial code changes to auth session verification (`auth.ts`, `crypto.ts`, cookie handling), adding external auth dependencies or a custom multi-database proxy.

3. **Option 3: In-App Multi-Tenancy (Single Application & Database Scoped by Organization)**
   - Introduce an `Organization` / `Team` tenant boundary across the entire schema (`Member`, `Quiz`, `Rsvp`, `Session`, `Feedback`, `TeamSetting`).
   - Route requests by subdomain or URL path with a tenant context provider and allow `SUPERADMIN` roles.
   - _Pros:_
     - Single deployment URL and unified login dashboard with an in-app team switcher.
   - _Cons:_
     - Violates the explicit requirement for separate databases.
     - Massive cross-cutting architectural rewrite touching database schema, foreign key constraints, Prisma queries, server actions, caching, and client state.
     - High risk of cross-tenant data leaks due to missed tenant filters.

## Decision Outcome

**Status:** **Proposed (Preference: Option 1)**

We propose **Option 1 (Dedicated Second Vercel Deployment + Independent Database)** as the preferred strategy for multi-team rollout.

Because this architectural decision is currently under exploration, no final commitment or infrastructure provisioning has been executed. Option 1 is designated as the preferred path because it fulfills 100% of the functional and isolation requirements immediately with zero codebase refactoring risk, keeping the core domain clean and robust.

## Consequences

- **Positive (if accepted):**
  - Teams have complete privacy and database sovereignty.
  - Deployment is purely operational via Vercel dashboard and standard CLI commands (`npx prisma db push`, `npx tsx prisma/seed.ts`).
  - Core domain models remain clean and free from tenant-scoping bloat.
  - Upgrades and bugfixes to the repository deploy automatically to all connected Vercel projects simultaneously.
- **Negative / Trade-offs:**
  - Admin access is partitioned by domain; browser password managers or PIN entries are managed per domain rather than via single sign-on.
- **Invariants Introduced:**
  - The core domain model remains single-tenant per database instance. Cross-team isolation is enforced at the physical deployment/database boundary rather than in application code.

## Validation & Confirmation

- **Provisioning verification:** Run `DATABASE_URL="..." npx prisma db push` and `DATABASE_URL="..." npx tsx prisma/seed.ts` against a secondary database connection string and confirm clean schema provisioning and admin user creation.
- **Production smoke test:** Deploy the secondary Vercel project, verify environment variable separation (`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `APP_URL`), log in as admin, and verify zero data collision with the primary deployment.
