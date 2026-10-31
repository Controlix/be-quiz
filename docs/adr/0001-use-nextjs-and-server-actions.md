# ADR 0001: Use Next.js App Router and Server Actions

**Date:** 2026-10-24  
**Status:** Accepted  
**Deciders:** Core Engineering Team  

---

## Context & Problem Statement
We needed a modern, full-stack React framework for a mobile-first pub quiz team coordination app. The system requires fast server-side rendering, secure cookie authentication, and robust server-side mutations for transactional RSVP queueing without the operational overhead of managing and orchestrating a separate backend API service.

## Decision Drivers
- Unified full-stack developer experience in TypeScript.
- Simplified deployment model (single Docker container / serverless instance).
- First-class React 19 Server Components and server-side mutations without REST boilerplate.
- Built-in API route handling for specialized feeds (e.g., `.ics` calendar subscriptions, file uploads).

## Considered Options
1. **Option 1: Separate Backend API (Node.js/Fastify) + React Vite SPA**
   - *Pros:* Complete decoupling between client bundle and backend execution.
   - *Cons:* Requires orchestrating two build pipelines, CORS configuration, dual deployment targets, and duplicate TypeScript interface sharing.
2. **Option 2: Remix (React Router v7)**
   - *Pros:* Excellent form-action handling and web standards focus.
   - *Cons:* Smaller ecosystem and deployment integrations compared to Next.js in our target environments.
3. **Option 3: Next.js App Router + Server Actions (Selected)**
   - *Pros:* Native integration of React Server Components, server actions as RPC-like controller endpoints, simplified session cookie management, and single-container Docker packaging.
   - *Cons:* Tighter initial coupling between UI and server logic, requiring disciplined isolation via a distinct `src/services/` layer.

## Decision Outcome
We chose **Option 3 (Next.js App Router + Server Actions)**. Server Actions (`src/actions/`) act as controller adapters that validate inputs and auth sessions, delegating business rules directly to our core service layer (`src/services/`).

## Consequences
- **Positive:**
  - Zero REST boilerplate required for standard UI mutations (RSVPs, payments, registration toggles).
  - End-to-end type safety between database Prisma queries, domain services, and client components.
  - Streamlined single Docker container build.
- **Negative / Trade-offs:**
  - Requires strict discipline to avoid importing server-only packages into client components.
- **Invariants Introduced:**
  - Controller logic in Server Actions must strictly delegate domain business logic to `src/services/`.

## Validation & Confirmation
- Tested via Next.js production builds (`next build`) and automated service tests in Vitest.
