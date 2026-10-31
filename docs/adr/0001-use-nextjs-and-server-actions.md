# ADR 0001: Use Next.js App Router and Server Actions

## Status
Accepted

## Context
We needed a modern, full-stack React framework that supports fast server-side rendering, seamless routing, and secure server-side mutations without needing to maintain a separate backend API server.

## Decision
We chose **Next.js App Router** combined with **Server Actions** (`src/actions/`).

## Consequences
- **Pros:** Simplified data fetching and mutations, reduced boilerplate code (no need for standalone REST API controllers for every action), and excellent TypeScript integration.
- **Cons:** Tighter coupling between frontend components and backend execution logic, requiring disciplined separation via our `src/services/` layer.
