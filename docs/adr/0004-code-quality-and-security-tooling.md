# ADR 0004: Code Quality, Formatting, and Security Tooling Architecture

**Date:** 2026-11-04  
**Status:** Accepted  
**Deciders:** Marc Bogaerts & Development Team

---

## Context & Problem Statement

The `be-quiz` repository previously lacked an automated linter, a code style/import formatter, and automated vulnerability/secret scanning. While TypeScript compiler checks (`tsc --noEmit`) and Vitest test suites guarded functional correctness, code formatting and React/Next.js runtime boundary conventions (such as Next.js image optimization and unused imports) were not automatically checked. Furthermore, without automated secret scanning on pre-commit, accidental commits of API keys or database credentials posed a persistent risk.

Additionally, the project currently operates without a remote continuous integration (CI) runner, necessitating a local-first validation workflow that executes rapidly without disrupting development flow.

## Decision Drivers

- **Next.js & React 19 Architectural Invariants:** Strict awareness of App Router boundaries, Server Components, and Next.js optimization rules.
- **Tailwind CSS v4 Consistency:** Automatic, deterministic ordering of utility classes across all UI components.
- **Local-First Speed & Developer Ergonomics:** Fast pre-commit checks (< 1 second) inspecting strictly staged files via Git hooks.
- **Node-Native Portability:** Zero reliance on Docker or external native Go binary installations for local developer checks.
- **Graceful Baseline Vulnerability Handling:** Ability to block newly introduced high/critical CVEs while allowlisting known upstream transitive vendor advisories that cannot be immediately updated without breaking changes.

## Considered Options

1. **Option 1: Biome (`@biomejs/biome`)**
   - _Pros:_ Blazing fast Rust binary; single unified configuration file (`biome.json`); zero dependency sprawl.
   - _Cons:_ Lacks official `eslint-config-next` App Router and RSC rules; does not support Tailwind CSS class sorting.

2. **Option 2: Native Next.js ESLint + Prettier + Secretlint + `audit-ci` (Selected)**
   - _Pros:_ Uses official Next.js ESLint rules (`@next/eslint-plugin-next`), Prettier with `prettier-plugin-tailwindcss` for class sorting, `secretlint` for Node-native local secret leak prevention, and `audit-ci` for configurable CVE auditing.
   - _Cons:_ More dependencies in `devDependencies`; requires coordinating ESLint and Prettier (resolved cleanly via `eslint-config-prettier`).

3. **Option 3: External Binary Scanning (Gitleaks Go binary + Docker-based SAST locally)**
   - _Pros:_ Deep historical repository scans.
   - _Cons:_ Heavyweight; requires Docker daemon or platform-specific native binaries; slow and cumbersome for local git pre-commit hooks.

## Decision Outcome

We chose **Option 2 (Next.js ESLint + Prettier + Secretlint + `audit-ci`)** because it balances Next.js App Router/Server Component correctness and Tailwind class sorting with sub-second local Git hook validation.

### Key Architectural Invariants Established:

1. **Single Source of Truth for Formatting:** Prettier owns all code styling rules (`.prettierrc.json`); ESLint is strictly dedicated to code quality and boundary checking. `eslint-config-prettier` turns off all stylistic ESLint rules to eliminate conflicts.
2. **Sub-Second Staged Hook Execution:** Git pre-commit hooks (`husky` + `lint-staged`) only inspect staged files, executing Secretlint, Prettier, and ESLint in parallel to prevent developer friction.
3. **No Automatic Commits:** Git hooks never create commits automatically or alter unstaged working files.
4. **Active Dependency Resolution & Zero-Allowlist Discipline:** Security advisories must never be prematurely hidden behind allowlists. All transitive vendor advisories must be actively evaluated and resolved first via `package.json#overrides` (e.g. pinning `@vercel/oidc: ^4.0.6` for `@vercel/blob`, `deepmerge-ts: ^8.0.2` for Prisma, and `minimatch: ^11.0.4`). The `audit-ci.json` threshold enforces `moderate: true` with an empty allowlist (`[]`) by default, perfectly aligning local checks with GitHub Dependabot standards. If an exception is ever unavoidable as a last resort, it must be tracked as temporary debt and re-evaluated during every dependency audit.

## Consequences

- **Positive:**
  - Automated detection of unused imports, unhandled catch errors, and missing image optimizations.
  - Automatically sorted Tailwind classes across all TSX components.
  - Pre-commit prevention of secret leaks before changes are recorded in Git history.
  - Turnkey GitHub Actions CI and CodeQL security workflows ready for immediate deployment when remote CI is enabled.
- **Negative / Trade-offs:**
  - Added developer dependencies in `devDependencies`.
  - Upstream vendor advisories require monitoring and periodic evaluation for non-breaking upgrade opportunities.

## Validation & Confirmation

- `npm run check:all` executes `typecheck`, `test`, `lint`, `format:check`, `audit:check`, and `scan:secrets` in sequence and exits with code `0`.
- Husky pre-commit hook triggers `lint-staged` on staged files.
