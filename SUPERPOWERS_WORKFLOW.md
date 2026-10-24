# Superpowers Development Lifecycle: Idea to Finished Product

This guide documents the step-by-step workflow for taking an idea from concept to a production-ready software product using the Superpowers framework.

---

## Workflow Overview

```
[Idea / Feature Request]
          │
          ▼
   1. brainstorming
          │
          ▼
   2. writing-plans
          │
          ▼
   3. using-git-worktrees
          │
          ▼
   4. test-driven-development (TDD)
      ┌───┴────────────────────────┐
      ▼                            ▼
   executing-plans        subagent-driven-development
      │                            │
      └───────────┬────────────────┘
                  │ (if errors or test failures occur)
                  ▼
          5. systematic-debugging
                  │
                  ▼
          6. requesting-code-review & receiving-code-review
                  │
                  ▼
          7. verification-before-completion
                  │
                  ▼
          8. finishing-a-development-branch
                  │
                  ▼
          9. Deployment (e.g., deploying-laravel-cloud)
                  │
                  ▼
       [Finished Product in Production]
```

---

## The Phases

### Phase 1: Exploration & Definition

#### 1. `brainstorming`
* **Trigger:** Before any creative work, building components, adding features, or changing behaviors.
* **Goal:** Clarify requirements, explore alternatives, validate architectural decisions, challenge assumptions, and define edge cases before touching any code.
* **Key Activities:**
  * Understand the problem domain and user needs.
  * Compare alternative architectural and tech stack approaches.
  * Clarify trade-offs and define non-functional requirements.

---

### Phase 2: Architecture & Task Breakdown

#### 2. `writing-plans`
* **Trigger:** Requirements and design direction have been decided via brainstorming.
* **Goal:** Break the solution into an ordered, bite-sized, and verifiable implementation plan.
* **Key Activities:**
  * Specify exact files to create or modify.
  * Define explicit test cases before implementation steps.
  * Ensure steps are modular and independent where possible.

#### 3. `using-git-worktrees`
* **Trigger:** Before starting implementation of the plan.
* **Goal:** Isolate feature development in a dedicated Git worktree or branch.
* **Key Activities:**
  * Keep the main repository branch clean and stable.
  * Work in an isolated directory so multiple streams of work can happen in parallel without merge collisions.

---

### Phase 3: Implementation & Construction

#### 4. `test-driven-development` (TDD)
* **Trigger:** For every unit of functionality or bug fix.
* **Goal:** Build rock-solid code with high confidence and regression prevention.
* **The Cycle (Red -> Green -> Refactor):**
  1. **Red:** Write a failing test defining the expected behavior.
  2. **Green:** Write the minimal code required to pass the test.
  3. **Refactor:** Clean up the implementation while keeping tests green.

#### 5. Orchestration: `executing-plans` vs `subagent-driven-development`
Choose the execution strategy that matches your task structure:
* **`executing-plans`:** Use when working sequentially with direct developer checkpoints and continuous feedback.
* **`subagent-driven-development` (with `dispatching-parallel-agents`):** Use when the plan has two or more independent tasks that can be worked on concurrently without shared state.

#### 6. `systematic-debugging`
* **Trigger:** As soon as a test fails unexpectedly, an error is thrown, or unexpected behavior occurs.
* **Goal:** Stop trial-and-error guessing and resolve root causes through evidence.
* **Key Activities:**
  * Gather concrete facts and error traces first.
  * Formulate testable hypotheses before touching code.
  * Implement targeted fixes and verify with regression tests.

---

### Phase 4: Quality & Validation

#### 7. `requesting-code-review` & `receiving-code-review`
* **Trigger:** Major components, milestones, or full features are implemented.
* **Goal:** Ensure code adheres to quality standards, edge cases are covered, and implementation matches requirements.
* **Key Activities:**
  * Rigorous self-review and automated checks.
  * Objective evaluation of review feedback before blindly accepting suggestions.

#### 8. `verification-before-completion`
* **Trigger:** Before declaring any task, bugfix, or feature complete.
* **Rule:** **Evidence before assertions always.** Never claim a task is complete without running verification commands.
* **Key Activities:**
  * Run full test suites and capture passing output.
  * Run linters, typecheckers, and build scripts.
  * Verify real runtime behavior.

---

### Phase 5: Integration & Delivery

#### 9. `finishing-a-development-branch`
* **Trigger:** All tests pass, reviews are addressed, and verification is confirmed.
* **Goal:** Cleanly integrate work into the main branch.
* **Key Activities:**
  * Rebase or merge cleanly according to repo strategy.
  * Clean up temporary branches/worktrees.

#### 10. Deployment (e.g., `deploying-laravel-cloud` or target CI/CD)
* **Trigger:** Code is merged and ready for staging or production.
* **Goal:** Ship the application to end users safely.
* **Key Activities:**
  * Environment configuration and secret management.
  * Running database migrations.
  * Health checks and rollout verification.

---

## Quick Reference Summary

| Phase | Superpower Skill | Primary Question Answered |
|---|---|---|
| **1. Explore** | `brainstorming` | *What are we building and why? What are the alternatives?* |
| **2. Plan** | `writing-plans` | *How do we break this down into verifiable, bite-sized tasks?* |
| **2. Isolate** | `using-git-worktrees` | *Where can we safely write this without dirtying main?* |
| **3. Build** | `test-driven-development` | *Does every piece of code have an automated test first?* |
| **3. Execute** | `executing-plans` / `subagent-driven-development` | *Are tasks being methodically executed and tracked?* |
| **3. Fix** | `systematic-debugging` | *What is the root cause backed by evidence?* |
| **4. Review** | `requesting-code-review` / `receiving-code-review` | *Does this code meet architecture and quality standards?* |
| **4. Verify** | `verification-before-completion` | *Do we have concrete proof that all tests and builds pass?* |
| **5. Ship** | `finishing-a-development-branch` & Deploy | *Is the branch clean, merged, and safely deployed?* |
