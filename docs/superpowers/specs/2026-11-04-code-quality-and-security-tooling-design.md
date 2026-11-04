# Design Specification: Code Quality & Security Tooling (Roadmap Part 2, Section E)

**Date:** 2026-11-04  
**Status:** Draft  
**Scope:** Roadmap Part 2.E (Items 12 & 13)

---

## 1. Intent & Context

The **be-quiz** repository currently relies on `typecheck` (`tsc --noEmit`) and `test` (`vitest run`), but lacks an automated linter, a code style/import formatter, and automated security scanning.

The goal of this project is to implement **Roadmap Part 2, Section E (Items 12 & 13)**:

1. **Item 12 — Dedicated Linter & Code Style Enforcement:** Implement ESLint (Flat Config) with official Next.js App Router and React Server Component rules, Prettier with Tailwind CSS v4 class sorting, and unified developer scripts.
2. **Item 13 — Automated Vulnerability Scanning & Security Auditing:** Enforce local pre-commit secret leak prevention, dependency CVE checks, and turnkey static security scanning workflows.

Because the project currently operates without a remote CI runner, **all validations must run locally** with fast execution and zero disruption to the development workflow. Ready-to-use GitHub Actions workflow files will also be supplied for future CI activation.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals

- **Strict Linting for Next.js App Router:** Catch common React 19 / RSC bugs, unused imports, bad image usage, and type errors via ESLint flat config (`eslint.config.mjs`).
- **Automated Formatting with Tailwind Sorting:** Ensure all TypeScript, TSX, CSS, and JSON files are formatted consistently, with Tailwind CSS classes automatically ordered via `prettier-plugin-tailwindcss`.
- **Local Secret Scanning on Pre-Commit:** Automatically intercept and prevent accidental commits containing API keys, private keys, authentication secrets, or database URLs (using platform-agnostic `secretlint`).
- **Dependency CVE Auditing:** Provide `npm run audit:check` (and audit fixing workflows) to flag high/critical security advisories in upstream packages.
- **Git Hook Automation:** Lightweight pre-commit hooks via `husky` + `lint-staged` running format checks, linting, and secret scanning only on staged files for sub-second execution.
- **Turnkey CI Workflow Templates:** Pre-configured GitHub Actions workflows for CodeQL SAST, Dependabot, and Secret Scanning ready for when remote CI is configured.

### 2.2 Non-Goals

- Mandating remote CI runners before local code can be committed.
- Re-architecting existing application logic or changing test suite behavior.
- Auto-committing files via git (all git commits remain strictly manual with explicit user consent).

### 2.3 Anti-Goals

- Heavy tools that require Docker or external native Go binaries for everyday local development.
- Slower pre-commit hooks that scan the entire repository instead of only staged files.
- Conflicting formatting rules between ESLint and Prettier.

---

## 3. Approaches Considered & Decision Outcome

### Option 1: Biome (`@biomejs/biome`)

- **Pros:** Extremely fast (Rust binary), single unified config file (`biome.json`), zero dependency sprawl.
- **Cons:** Lacks official `eslint-config-next` App Router and RSC rules; does not support Tailwind CSS class sorting.

### Option 2: Next.js ESLint (Flat Config) + Prettier + Tailwind Plugin (Selected)

- **Pros:** Official Next.js standard with `eslint-config-next`, React 19 Server Components awareness, automatic Tailwind v4 class sorting via `prettier-plugin-tailwindcss`, and universal IDE support.
- **Cons:** More dependencies than Biome, slightly slower full-repo execution.
- **Decision:** **Option 2 selected by user.** Accurate Next.js App Router rules and Tailwind class ordering are high priorities for be-quiz.

---

## 4. Technical Architecture & Implementation Details

### 4.1 Linting: ESLint Flat Config (`eslint.config.mjs`)

- Uses ESLint 9+ flat config syntax compatible with Next.js 16 (`eslint-config-next/core-web-vitals` / flat config compat).
- Integrates TypeScript rules (`@typescript-eslint`).
- Configures rules:
  - Disallow unused variables (with `_` prefix ignore pattern).
  - Next.js Core Web Vitals and React hooks.
  - Disable formatting-related ESLint rules to prevent conflicts with Prettier (`eslint-config-prettier`).

### 4.2 Formatting: Prettier (`.prettierrc.json` & `.prettierignore`)

- Configuration:
  - 2 spaces indentation, semi-colons enabled, single quotes for JavaScript/TypeScript, trailing commas (`es5`).
  - Plugins: `prettier-plugin-tailwindcss` for Tailwind CSS v4 class sorting.
- Ignore paths: `.next/`, `node_modules/`, `public/uploads/`, `dist/`.

### 4.3 Secret Scanning: Local `secretlint` (`.secretlintrc.json`)

- Uses `@secretlint/quick-start` / `@secretlint/secretlint-rule-preset-recommend`:
  - 100% pure Node.js tool (no external Go/Docker dependencies required).
  - Detects AWS keys, Google API keys, private keys, database passwords, JWT tokens, and common secret patterns.
  - Runs in `lint-staged` on all staged files before commit.

### 4.4 Pre-Commit Hooks (`husky` + `lint-staged`)

- `lint-staged` configured in `package.json` or `.lintstagedrc.json`:
  ```json
  {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"],
    "*": ["secretlint"]
  }
  ```
- `husky` hooks:
  - `.husky/pre-commit`: runs `npx lint-staged`.

### 4.5 Package Scripts & Security Auditing

- `lint`: `next lint`
- `lint:fix`: `next lint --fix`
- `format:check`: `prettier --check .`
- `format:write`: `prettier --write .`
- `audit:check`: `audit-ci --high` (configured via `audit-ci.json` with temporary allowlist for upstream vendor advisories in Prisma/Vercel transitive dependencies)
- `scan:secrets`: `secretlint "**/*"`
- `check:all`: `npm run typecheck && npm run test && npm run lint && npm run format:check && npm run audit:check && npm run scan:secrets`

### 4.6 Baseline Vulnerability Strategy

- **Allowlist for Known Transitive Advisories:** Configure `audit-ci.json` to allowlist the existing transitive advisories (`deepmerge-ts` from `@prisma/config`, `zod` from `@vercel/blob`) so `npm run audit:check` passes with exit code 0 while immediately failing on any newly introduced high/critical vulnerabilities.
- **Isolated Upgrade Investigation:** Test potential non-breaking package updates on an isolated git branch to determine if upstream advisories can be eliminated without breaking database or runtime behavior. If safe, merge the upgrades; otherwise, retain the allowlist until upstream releases patches.

### 4.7 Turnkey CI Workflows (Ready for Future Remote CI)

- `.github/workflows/ci.yml`: Runs `typecheck`, `test`, `lint`, and `format:check`.
- `.github/workflows/security.yml`: Runs GitHub CodeQL SAST analysis and Gitleaks secret scanning.
- `.github/dependabot.yml`: Automated weekly dependency vulnerability tracking.

---

## 5. Architectural Invariant Adherence

1. **Zero Impact on Runtime State:** Tooling is dev-only and changes no runtime domain logic.
2. **Single Source of Truth:** Formatting rules are owned entirely by Prettier (`.prettierrc.json`); ESLint handles code quality only.
3. **No Automatic Commits:** Git hooks only validate staged files; they never create commits or alter unstaged files.

---

## 6. What's Left to the Builder

- Selecting exact dependency versions in `devDependencies` compatible with Next.js 16 and TypeScript.
- Resolving any initial lint or formatting warnings across the existing codebase during the baseline pass.
- Ensuring `.husky/pre-commit` operates cleanly in both Unix and Windows environments.
