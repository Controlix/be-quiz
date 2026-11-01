---
name: documenting-feature-release
description: "Use when finishing any implementation plan, feature, bugfix, or milestone release before claiming work is complete or ready to merge — enforces strict synchronization of CHANGELOG.md, docs/roadmap.md, DEPLOYMENT.md, .env.example, database schema, and API contracts."
---

# Documenting Feature Releases & Plan Closeout

## Overview

Code implementation and passing tests are only half of the release. Work is **not complete** until the repository's single sources of truth accurately reflect the changes.

**Core Principle:** Never declare an implementation complete, request a merge, or present finished work without executing this closeout verification gate.

---

## The Mandatory Closeout Gate

Before declaring work finished, run `git diff --stat HEAD` (or diff against your base branch) and execute this 5-gate checklist:

```
┌─────────────────────────────────────────────────────────────┐
│               Documentation Closeout Checklist               │
├─────────────────────────────────────────────────────────────┤
│ 1. CHANGELOG.md              → Version, date, categories    │
│ 2. docs/roadmap.md & Archive → Archive finished items       │
│ 3. DEPLOYMENT.md & Env       → .env.example, setup guides   │
│ 4. Schema & OpenAPI Specs    → DB schema.md, openapi.yaml   │
│ 5. Plan Tracking             → All plan checkboxes marked   │
└─────────────────────────────────────────────────────────────┘
```

---

### Gate 1: `CHANGELOG.md` Synchronization
- **Format:** Follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
- **Header:** Include the version and date: `## [vX.Y.Z] - YYYY-MM-DD`.
- **Categories:** Group changes cleanly under:
  - `Added` for new features or capabilities.
  - `Changed` for modifications in existing behavior or UI.
  - `Fixed` for bugfixes.
  - `Architectural Changes` for decoupled subsystems, event bus, reducers, or refactoring.
- **Consistency Check:** Ensure the version in `package.json` matches the changelog version.

---

### Gate 2: Roadmap & Feedback Lifecycle
- **Active Backlog ONLY:** `docs/roadmap.md` is strictly for **active priorities and future backlog**. Completed features must NEVER linger as checked-off clutter in `docs/roadmap.md`.
- **Immediate Archiving:** Move full descriptions, user feedback notes, and technical scopes of completed items into `docs/superpowers/feedback/archive-<milestone>-completed.md` (e.g. `archive-v2.0-completed.md`).
- **Version Header:** Update `**Current App Version:**` at the top of `docs/roadmap.md` to match the newly completed version.

---

### Gate 3: Deployment Documentation & Environment Variables
- **Audit New Environment Variables:**
  ```bash
  git diff HEAD | grep -E "process\.env\.[A-Z0-9_]+"
  ```
- **Sync `.env.example`:** Every new variable or capability flag (`ENABLE_*`) must be present in `.env.example` with clear comments explaining purpose, default value, and required external credentials.
- **Sync Root `DEPLOYMENT.md`:** Update Step 6 (Environment Variables table) and add configuration steps for any new external service, permission grants, or keys.
- **Sync `docs/deployment/overview.md`:** Document compute model impact (Vercel serverless lifecycle, background promises, Next.js `after()`, or Docker standalone).

---

### Gate 4: Database Schema & API Contracts
- **Database Schema (`docs/database/schema.md`):**
  - If `prisma/schema.prisma` was modified (new models, relations, or fields), update `docs/database/schema.md` to reflect the changes.
  - Verify migration instructions (`prisma db push` / `prisma migrate`).
- **API Contracts (`docs/api/openapi.yaml`):**
  - If any HTTP route handlers in `src/app/api/` were added or modified, update `docs/api/openapi.yaml` with accurate parameters, request payloads, response schemas, and status codes.

---

### Gate 5: Plan Checklists
- Inspect the active implementation plan (`docs/superpowers/plans/...`).
- Ensure every completed task and sub-step checkbox is checked (`- [x]`).
- Record any code review findings or remediation items in the plan's review section.

---

## Rationalization Prevention

| Excuse | Reality |
|---|---|
| "The tests pass, docs can be done later." | "Later" never happens. Untracked docs create immediate blind spots for deployment and collaboration. |
| "This was just an internal refactor, no changelog entry needed." | Architectural changes, event buses, and refactors are vital historical notes. Document them under `Architectural Changes`. |
| "I'll leave the completed item in roadmap.md so people see it was done." | Anti-pattern. Roadmap is for active backlog only. Completed items belong in `CHANGELOG.md` and `docs/superpowers/feedback/archive-*.md`. |
| "The environment variable is optional, so DEPLOYMENT.md doesn't need it." | If an operator or teammate tries to enable the feature, they won't know what credentials or permissions are required. Always document it. |
| "I already answered the user's questions, so we're done." | You are not done until the repo's single sources of truth are updated and verified. |

---

## Red Flags

STOP if you are about to:
- Say "Implementation is complete!" without having checked `CHANGELOG.md`.
- Say "All done!" while `git diff` shows new `process.env` keys that aren't in `DEPLOYMENT.md` and `.env.example`.
- Leave completed milestone tasks inside `docs/roadmap.md`.
- Modify `prisma/schema.prisma` without updating `docs/database/schema.md`.
