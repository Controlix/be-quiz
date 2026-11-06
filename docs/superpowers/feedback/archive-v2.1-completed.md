# Milestone v2.1 Archive — Code Quality & Security Tooling

**Archived Date:** 2026-11-06  
**App Version:** `v2.1.1`  
**Related Specs & Plans:**

- Spec: `docs/superpowers/specs/2026-11-04-code-quality-and-security-tooling-design.md`
- Implementation Plan: `docs/superpowers/plans/2026-11-04-code-quality-and-security-tooling.md`
- ADR: `docs/adr/0004-code-quality-and-security-tooling.md`

---

## Completed Roadmap Items

### 12. Dedicated Linter & Code Style Enforcement (ESLint / Prettier)

- **Delivered:** Configured ESLint 9 Flat Config (`eslint.config.mjs`) with `@next/eslint-plugin-next`, TypeScript rules, and Prettier (`.prettierrc.json`) with `prettier-plugin-tailwindcss` for automated Tailwind CSS class ordering.
- **Git Hook Automation:** Configured `husky` and `lint-staged` (`.lintstagedrc.json`) to execute auto-fixing and formatting on staged files before every commit.

### 13. Automated Vulnerability Scanning & Security Auditing

- **Dependency CVE Auditing:** Configured `audit-ci` (`audit-ci.json`) with baseline allowlists for existing transitive vendor advisories (`deepmerge-ts` in `@prisma/config` and `zod` in `@vercel/blob`) ensuring clean exit codes while detecting new high/critical vulnerabilities.
- **Local Secret Scanning:** Integrated `secretlint` (`.secretlintrc.json`, `.secretlintignore`) into `npm run scan:secrets` and staged Git hooks to prevent accidental commits of API keys, private keys, and credentials.
- **Turnkey CI Workflows:** Added `.github/dependabot.yml`, `.github/workflows/ci.yml`, and `.github/workflows/security.yml` (CodeQL SAST + Gitleaks).

### 14. GitHub Actions CI: PostgreSQL Service Container for Automated Test Suites

- **Delivered:** Configured a native `postgres:16-alpine` service container with container healthchecks (`pg_isready -U quiz -d be_quiz`), `DATABASE_URL` environment configuration, and automated `npx prisma db push` schema initialization in `.github/workflows/ci.yml`.
- **Related ADR & Plan:**
  - ADR: `docs/adr/0005-ci-postgresql-service-container.md`
  - Spec: `docs/superpowers/specs/2026-11-06-ci-postgres-service-design.md`
  - Plan: `docs/superpowers/plans/2026-11-06-ci-postgres-service.md`
