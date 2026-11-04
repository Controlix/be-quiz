# Code Quality & Security Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an automated, local-first code quality, formatting, secret scanning, and vulnerability auditing toolchain for be-quiz, complete with documentation and CI workflows.

**Architecture:** Implement ESLint (Flat Config) with official Next.js App Router rules and Prettier with Tailwind CSS v4 class ordering. Enforce local pre-commit verification via `husky` + `lint-staged` running `secretlint`, Prettier, and ESLint on staged files. Enforce dependency CVE auditing via `audit-ci` with temporary baseline allowlists, and document all architectural decisions in ADR-0004 and the Architecture Overview.

**Tech Stack:** Next.js 16, React 19, TypeScript, ESLint 9+ (Flat Config), `eslint-config-next`, Prettier, `prettier-plugin-tailwindcss`, `secretlint`, `audit-ci`, `husky`, `lint-staged`.

**Spec:** `docs/superpowers/specs/2026-11-04-code-quality-and-security-tooling-design.md`

## Global Constraints

- **No Git Commits Without Explicit Consent:** NEVER run `git commit` or create git commits unless the user has explicitly requested or consented to a commit.
- **Mandatory Instant Feedback (WHAT and WHY):** Before taking ANY action or executing ANY tool call, state explicitly WHAT you are doing and WHY you are doing it.
- **Strict Plan Checklist Discipline:** Update this markdown file to mark each step as complete (`- [x]`) immediately after finishing it.
- **Node-based Execution:** All lint, format, audit, and secret scanning scripts must run natively on Node.js without requiring Docker or external native Go toolchains.
- **Single Source of Truth:** Prettier owns formatting; `eslint-config-prettier` turns off conflicting ESLint formatting rules.

## Review Focus

1. **Pre-commit hook speed:** Git hooks must only scan staged files via `lint-staged` so commits remain sub-second.
2. **ESLint / Prettier conflicts:** Ensure `eslint-config-prettier` prevents double-reporting or warring styles.
3. **Audit exit code:** `npm run audit:check` must exit with code 0 on the baseline repository by properly configuring `audit-ci.json` for known upstream vendor advisories.
4. **Secretlint false positives:** Verify `secretlint` does not flag dummy test tokens or `.env.example` placeholders.
5. **Windows & Unix Hook Compatibility:** Ensure Husky hooks execute cleanly across standard posix/bash environments.

---

### Task 1: Prettier & Tailwind CSS v4 Formatting Setup

**Files:**

- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json`

**Interfaces:**

- Produces: `npm run format:check` and `npm run format:write` scripts; clean repository formatting baseline.

- [x] **Step 1: Install Prettier and Tailwind plugin**

Install devDependencies:

```bash
npm install -D prettier prettier-plugin-tailwindcss eslint-config-prettier
```

- [x] **Step 2: Create `.prettierrc.json` configuration**

Create `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [x] **Step 3: Create `.prettierignore` file**

Create `.prettierignore`:

```text
.next/
node_modules/
dist/
public/uploads/
package-lock.json
```

- [x] **Step 4: Add format scripts to `package.json`**

Add scripts:

- `"format:check": "prettier --check ."`
- `"format:write": "prettier --write ."`

- [x] **Step 5: Run `npm run format:write` and verify with `npm run format:check`**

Run: `npm run format:write`  
Run: `npm run format:check`  
Expected: All matched files formatted, exiting with code 0.

---

### Task 2: ESLint Flat Config Setup (`eslint.config.mjs`)

**Files:**

- Create: `eslint.config.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: Prettier config (`eslint-config-prettier`)
- Produces: `npm run lint` and `npm run lint:fix` scripts passing cleanly.

- [x] **Step 1: Install ESLint and Next.js lint dependencies**

Install devDependencies:

```bash
npm install -D eslint eslint-config-next @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

- [x] **Step 2: Create `eslint.config.mjs` flat config**

Create `eslint.config.mjs` with Next.js flat-config compatibility, TypeScript support, ignore patterns (`.next/`, `node_modules/`, `public/uploads/`), and `eslint-config-prettier` integration.

- [x] **Step 3: Add lint scripts to `package.json`**

Add scripts:

- `"lint": "next lint"`
- `"lint:fix": "next lint --fix"`

- [x] **Step 4: Run `npm run lint` and resolve any baseline lint issues**

Run: `npm run lint`  
Fix any unused imports or variables (prefixing intentionally ignored variables with `_`).  
Expected: `npm run lint` exits with code 0.

---

### Task 3: Local Secret Scanning & Vulnerability Auditing Setup

**Files:**

- Create: `.secretlintrc.json`
- Create: `.secretlintignore`
- Create: `audit-ci.json`
- Modify: `package.json`

**Interfaces:**

- Produces: `npm run scan:secrets`, `npm run audit:check`, and `npm run check:all` scripts.

- [x] **Step 1: Install Secretlint and audit-ci**

Install devDependencies:

```bash
npm install -D secretlint @secretlint/quick-start @secretlint/secretlint-rule-preset-recommend audit-ci
```

- [x] **Step 2: Create `.secretlintrc.json` and `.secretlintignore`**

Configure standard rule presets in `.secretlintrc.json`. Add `.next/`, `node_modules/`, `public/uploads/`, and `.env.example` to `.secretlintignore`.

- [x] **Step 3: Create `audit-ci.json` with temporary baseline allowlists**

Create `audit-ci.json` setting `"high": true` and allowlisting existing transitive advisories (`deepmerge-ts` from `@prisma/config` and `zod` from `@vercel/blob`).

- [x] **Step 4: Add security scripts to `package.json`**

Add scripts:

- `"scan:secrets": "secretlint \"**/*\""`
- `"audit:check": "audit-ci --config ./audit-ci.json"`
- `"check:all": "npm run typecheck && npm run test && npm run lint && npm run format:check && npm run audit:check && npm run scan:secrets"`

- [x] **Step 5: Run and verify security scripts**

Run: `npm run scan:secrets`  
Expected: Secret scan passes with 0 violations.  
Run: `npm run audit:check`  
Expected: Audit passes with 0 unallowlisted high/critical vulnerabilities.

---

### Task 4: Git Hook Automation with `lint-staged` & `husky`

**Files:**

- Create: `.lintstagedrc.json`
- Create: `.husky/pre-commit`
- Modify: `package.json`

**Interfaces:**

- Consumes: `format:write`, `lint:fix`, `secretlint`
- Produces: Automatic pre-commit validation on staged files.

- [x] **Step 1: Install husky and lint-staged**

Install devDependencies:

```bash
npm install -D husky lint-staged
```

- [x] **Step 2: Initialize husky**

Run: `npx husky init`  
Configure `.husky/pre-commit` to execute `npx lint-staged`.

- [x] **Step 3: Create `.lintstagedrc.json`**

Create `.lintstagedrc.json`:

```json
{
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"],
  "*": ["secretlint"]
}
```

- [x] **Step 4: Verify `lint-staged` execution**

Run: `npx lint-staged`  
Expected: Passes cleanly with code 0 on clean/staged working tree.

---

### Task 5: Turnkey CI Workflows & Dependabot

**Files:**

- Create: `.github/dependabot.yml`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/security.yml`

**Interfaces:**

- Produces: Automated remote CI configurations ready for activation when GitHub CI is enabled.

- [x] **Step 1: Create `.github/dependabot.yml`**

Configure weekly npm dependency updates.

- [x] **Step 2: Create `.github/workflows/ci.yml`**

Create standard GitHub Action running `npm run check:all`.

- [x] **Step 3: Create `.github/workflows/security.yml`**

Create GitHub Action running GitHub CodeQL SAST and Gitleaks secret analysis.

---

### Task 6: Architecture Documentation & ADR-0004

**Files:**

- Create: `docs/adr/0004-code-quality-and-security-tooling.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/roadmap.md`

**Interfaces:**

- Produces: Complete architectural documentation and updated roadmap status.

- [x] **Step 1: Author ADR-0004**

Create `docs/adr/0004-code-quality-and-security-tooling.md` using the Pragmatic MADR template (`docs/adr/template.md`). Document deciders, context, drivers, options considered (Biome vs ESLint/Prettier, Secretlint vs Gitleaks/Docker), decision outcome, consequences, and validation confirmation.

- [x] **Step 2: Update `docs/architecture/overview.md`**

Update Section 3 (Technology Stack) and add a new Section 6 (Developer Tooling & Security Standards) detailing the tooling suites and validation commands.

- [x] **Step 3: Update `docs/roadmap.md`**

Update Part 2, Section E in `docs/roadmap.md` to link to the plan and track progress.

---

### Task 7: Isolated Dependency Upgrade Investigation

**Files:**

- Scratch testing / isolated branch evaluation

**Interfaces:**

- Consumes: Current package versions
- Produces: Findings on whether Prisma / `@vercel/blob` can be bumped without breaking changes to resolve baseline CVEs.

- [x] **Step 1: Test non-breaking minor/patch updates in isolation**

Check available updates for `@prisma/client`, `prisma`, and `@vercel/blob`.  
Run `npm test` and `npm run typecheck` against updated versions.

- [x] **Step 2: Determine outcome and update allowlist or dependencies**

If updates are non-breaking and clean, update dependencies and remove allowlist entries; if breaking changes exist, retain the allowlist in `audit-ci.json` and document the upgrade blocker in `docs/adr/0004-code-quality-and-security-tooling.md`. (Finding: Prisma 6.19.3 has no in-line patch for `deepmerge-ts` without upgrading to Prisma 7.10.1, which involves breaking client adapter changes; `@vercel/blob` has no in-line patch for its transitive `zod` dependency. The allowlist in `audit-ci.json` is retained).
