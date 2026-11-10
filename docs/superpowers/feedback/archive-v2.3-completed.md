# Completed Features & Historical Archive: v2.3.0

**Release Date:** 2026-11-10  
**Version:** `v2.3.0`  
**Focus:** Post-Quiz Evaluation & Historical Insights — Lightweight Quiz Rating & Display (Roadmap Item 11)

---

## 1. Lightweight Quiz Rating & Display (1 to 5 Stars)

- **Original Backlog Item:** Part 2, Section D, Item 11
- **Status:** Shipped in `v2.3.0`
- **Design Spec:** [`docs/superpowers/specs/2026-11-08-quiz-rating-design.md`](../specs/2026-11-08-quiz-rating-design.md)
- **Implementation Plan:** [`docs/superpowers/plans/2026-11-10-quiz-rating-implementation.md`](../plans/2026-11-10-quiz-rating-implementation.md)

### Summary of Delivered Work:

1. **Database Schema (`prisma/schema.prisma`):**
   - Added `QuizRating` model (`id`, `quizId`, `memberId`, `score`, `createdAt`, `updatedAt`) with compound unique constraint `@@unique([quizId, memberId])` and cascade deletion on `Quiz` and `Member`.
2. **Domain Service & Dynamic Lineup Filter (`src/services/ratingService.ts`, `src/lib/ratingRules.ts`):**
   - Pure domain calculation helper `computeRatingSummary` strictly aggregates votes from confirmed active lineup members (`attendingRsvps.slice(0, maxTeamSize)`).
   - If an admin moves a player to the reserve list after they rated, their vote is dynamically omitted from the average and count without destructive deletion.
   - Enforced conclusion check (`now >= startsAt + durationMinutes`) and rejected ratings on cancelled quizzes.
3. **Strict Privacy Architecture:**
   - Ratings are strictly private; individual player votes are never serialized to client payloads or attached to `Rsvp` models. Teammates only see aggregate metrics.
4. **Interactive UI (`src/components/QuizRatingWidget.tsx`):**
   - Accessible ARIA radio controls (1 to 5 stars) with hover effects, optimistic state updates, and error resilience.
   - Read-only aggregate summary for non-attending members, waitlisted reserves, and visitors.
5. **Dashboard Badging (`src/components/QuizCard.tsx`):**
   - Concluded past quizzes with ratings display a compact amber badge (`★ 4.3`).
   - Suppressed on cancelled quizzes.
