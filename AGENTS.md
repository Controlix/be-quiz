<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Documentation & Architecture Guidelines

Before planning, modifying, or implementing any features, database models, or structural changes, always consult the documentation in `docs/`:

- **Architecture Overview (`docs/architecture/overview.md`):** Consult for high-level system design, service layer patterns, subsystem interactions, and architectural invariants.
- **API Documentation (`docs/api/openapi.yaml`):** All HTTP route handlers, parameters, payloads, response schemas, and status codes must be maintained directly in the OpenAPI 3.1 specification (`docs/api/openapi.yaml`) as the single source of truth. Avoid creating redundant markdown endpoint documentation.
- **Database Schema & ERD (`docs/database/schema.md`):** Consult for database models, relationships, field types, constraints, and cascading rules before writing Prisma migrations or queries.
- **Architecture Decision Records (`docs/adr/`):** Check existing ADRs to align with established architectural decisions, and document new significant decisions by adding records here.
- **Maintain Documentation Consistency:** Whenever making architectural changes, modifying the database schema in `prisma/schema.prisma`, or altering core services, update the corresponding documents in `docs/` as part of the task.

## User Communication & Interaction Preferences

- **No Git Commits Without Explicit Consent:**
  - NEVER run `git commit` or create git commits unless the user has explicitly requested or consented to a commit.
  - Doing work, editing files, or running scripts does not imply permission to commit. Always ask first.

- **Mandatory Instant Feedback (WHAT and WHY):**
  - Before taking ANY action or executing ANY tool call (reading files, executing commands, searching, editing code, running tests, or dispatching subagents), you MUST provide instant message feedback to the user.
  - For every single step or action, explicitly state:
    - **WHAT** you are doing (the exact file, tool, command, or check).
    - **WHY** you are doing it (the rationale, objective, and purpose).
  - Never execute silent tool calls or chain multiple actions without prior explanation. The user must have continuous, real-time visibility into what you are doing and why.


