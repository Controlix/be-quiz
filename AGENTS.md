<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Documentation & Architecture Guidelines

Before planning, modifying, or implementing any features, database models, or structural changes, always consult the documentation in `docs/`:

- **Roadmap & Feature Backlog (`docs/roadmap.md`):** The single source of truth for active priorities, current milestones (e.g. v1.1), and future feature backlogs (v2). When picking up or finishing features, keep this document updated with their status. **Immediately track specs and plans:** As soon as a design spec or implementation plan is drafted or approved, update `docs/roadmap.md` to link directly to the spec/plan file and reflect its active state (e.g. `[ ] Spec Ready: docs/superpowers/specs/...`). **Archive Completed Items Immediately:** As soon as a roadmap item or feature is completed and shipped, remove it from `docs/roadmap.md` and archive its details into `docs/superpowers/feedback/archive-<milestone>-completed.md` (e.g. `archive-v1.1-completed.md`), keeping `docs/roadmap.md` strictly clean and free of completed historical clutter.
- **User Feedback & Remarks Lifecycle (`docs/superpowers/feedback/`):**
  - **NEVER append endlessly to a single feedback file.**
  - **Intake:** Record new testing remarks or feedback batches in dated files under `docs/superpowers/feedback/inbox/YYYY-MM-DD-<topic>.md`.
  - **Triage:** Distill actionable tasks into `docs/roadmap.md`.
  - **Archive:** When a milestone ships and its items are completed, archive the resolved items into `docs/superpowers/feedback/archive-<milestone>-completed.md` so that `docs/roadmap.md` stays lean, actionable, and free of historical clutter.
- **Architecture Overview (`docs/architecture/overview.md`):** Consult for high-level system design, service layer patterns, subsystem interactions, and architectural invariants. **Strict Architectural Adherence:** All designs, specs, and plans must strictly adhere to the documented architectural invariants—specifically maintaining a single source of truth for domain state (no duplicate, parallel client state arrays) and node-based deterministic testing without unconfigured browser DOM dependencies.
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

- **Remarks Are for Discussion, Not Code:**
  - When the user shares a remark, observation, or critique (e.g., "this feels cheap", "I noticed X"), treat it as an invitation to discuss and explore options. **Never** treat remarks as a wildcard or automatic trigger to write/edit code. Always discuss and confirm intent first.

- **Strict Step-by-Step Plan Checklist Discipline:**
  - Whenever executing an implementation plan with tasks and checkboxes (`- [ ]`), you MUST update the plan markdown file (`docs/superpowers/plans/...`) to mark each step as complete (`- [x]`) **immediately after finishing it**, before proceeding to the next step or task. Never defer marking checkboxes to the end.

- **Uncompromising Architectural Quality & Good Design by Default:**
  - **Highest Engineering Standards Required:** Apply deep software engineering principles, robust domain modeling, and pure functional state management by default.
  - **Single Source of Truth Invariant:** Always design around an authoritative single source of truth (e.g., pure state reducers, unified collections). NEVER introduce duplicate, fragmented, or parallel state arrays/hooks that can diverge or require manual synchronization.
  - **Pure State Derivations:** Any filtered sub-lists, member counts, status badges, or button states must be purely derived functions of the primary state, never stored in separate sync variables.
  - **Root Cause Solutions Only:** Never propose or write superficial quick patches, symptom workarounds, or band-aids that paper over architectural flaws. If a domain or state model is fragmented, refactor it to a clean, unified architecture first.
  - **Zero External/DOM Test Dependencies:** Keep reducers and domain transformations 100% pure TypeScript, tested with high speed and determinism under Node.js in Vitest without relying on browser DOM emulation or mock-heavy harnesses.
  - **Environment-Accurate Execution:** Never assume or hallucinate test libraries, runners, or dependencies; always inspect the actual repository configuration (`package.json`, test configs, and established codebase patterns) before drafting plans or writing code.

- **Mandatory Pre-Implementation Spec & Plan Review:**
  - ALWAYS perform an explicit, rigorous self-review of the design spec and implementation plan against real repository configurations before claiming the plan is complete or beginning implementation.
  - Check: (1) environment and dependencies (e.g. `package.json`, `vitest.config.ts`), (2) single-source-of-truth domain invariants, (3) unambiguous test steps, (4) type consistency across tasks, and (5) edge case coverage. Explicitly confirm this review to the user before starting implementation.


