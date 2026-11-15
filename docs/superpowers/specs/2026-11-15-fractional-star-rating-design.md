# Design Specification: Read-Only Fractional Star Rating Component

**Date:** 2026-11-15  
**Topic:** UI / Visual Evaluation — Fractional Star Rating Component (React + Tailwind CSS)  
**Status:** Approved

---

## 1. Intent & The Why

With the introduction of lightweight post-quiz rating (Roadmap Item 11 / `v2.4.0`), team ratings are aggregated and averaged to a decimal value (e.g., `4.3` or `3.75`).

Currently, star ratings in read-only contexts are rendered using simple integer rounding or full/empty star unicode characters. This loses precision and visual fidelity. A dedicated, lightweight, and accessible `ReadOnlyStarRating` component enables high-precision decimal star rendering (e.g. `4.35` out of `5`) without introducing external third-party UI dependencies or heavy icon bundles.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals

- **Arbitrary Decimal Precision:** Smoothly render fractional scores (e.g. `3.7`, `4.35`, `4.8`) by layering a percentage-clipped yellow foreground star over a gray background star.
- **Zero Heavy Dependencies:** Implemented purely with React, standard SVG paths, and Tailwind CSS.
- **Tailwind JIT Resilience:** Use inline percentage styles (`style={{ width: `${fillPercentage}%` }}`) for dynamic clipping to prevent uncompiled dynamic class issues with Tailwind JIT.
- **SVG Distortion Prevention:** Apply `max-w-none` and fixed explicit dimensions to the inner clipped SVG so that it does not squish or distort horizontally within the narrowed clipping container.
- **Accessibility (A11y):** The container provides a clear `role="img"` and formatted `aria-label` (e.g. `"4.35 out of 5 stars"`), while individual decorative SVGs are marked `aria-hidden="true"`.
- **Configurable & Reusable:** Expose props for `rating`, optional `maxStars` (default `5`), and `size` utility classes (default `'w-5 h-5'`).

### 2.2 Non-Goals

- **Interactive Voting Inputs:** This component is strictly read-only. Interactive tap/click rating inputs remain the responsibility of `QuizRatingWidget` (which uses distinct 1–5 clickable buttons).
- **External Icon Libraries:** No new icon package dependencies; uses standard, lightweight SVG star paths.
- **Half-Star Rounding Hack:** Avoid clunky 0.5 step rounding (e.g. Lucide `StarHalf`), allowing true continuous fractional visual representation.

### 2.3 Anti-Goals

- **DOM Emulation in Tests:** Keep the mathematical fill calculations and clamping logic pure and testable deterministically in Node.js Vitest unit tests.

---

## 3. Constraints & Architectural Invariants

1. **Input Clamping:** The rating is strictly clamped to `[0, maxStars]` via `Math.max(0, Math.min(rating, maxStars))` to prevent layout blowouts or negative widths.
2. **Deterministic Fill Math:** For each zero-based index `i`, fill percentage is calculated as:
   $$\text{fillPercentage} = \max(0, \min(1, \text{clampedRating} - i)) \times 100$$
   - Indices $< \lfloor\text{clampedRating}\rfloor$ yield `100%`.
   - Index $= \lfloor\text{clampedRating}\rfloor$ yields the fractional percentage (e.g. `0.35` $\rightarrow$ `35%`).
   - Indices $> \lfloor\text{clampedRating}\rfloor$ yield `0%` (overlay layer not rendered).
3. **Pure State & UI Simplicity:** No internal state, side effects, or hooks required.

---

## 4. Component Architecture & Props

### 4.1 Interface Contract

```tsx
export interface ReadOnlyStarRatingProps {
  rating: number;
  maxStars?: number;
  size?: string;
  className?: string;
}
```

### 4.2 Implementation Design (`src/components/ReadOnlyStarRating.tsx`)

```tsx
import React from "react";

export interface ReadOnlyStarRatingProps {
  rating: number;
  maxStars?: number;
  size?: string;
  className?: string;
}

const STAR_PATH =
  "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

export function calculateStarFillPercentage(
  rating: number,
  index: number,
  maxStars: number = 5
): number {
  const clampedRating = Math.max(0, Math.min(rating, maxStars));
  return Math.max(0, Math.min(1, clampedRating - index)) * 100;
}

export function ReadOnlyStarRating({
  rating,
  maxStars = 5,
  size = "w-5 h-5",
  className = "",
}: ReadOnlyStarRatingProps) {
  const clampedRating = Math.max(0, Math.min(rating, maxStars));

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`.trim()}
      role="img"
      aria-label={`${clampedRating} out of ${maxStars} stars`}
    >
      {Array.from({ length: maxStars }, (_, index) => {
        const fillPercentage = calculateStarFillPercentage(clampedRating, index, maxStars);

        return (
          <div key={index} className={`relative ${size}`}>
            {/* Background full-star (gray) */}
            <svg
              className={`${size} fill-current text-gray-300`}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d={STAR_PATH} />
            </svg>

            {/* Foreground clipped star (yellow) */}
            {fillPercentage > 0 && (
              <div
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillPercentage}%` }}
              >
                <svg
                  className={`${size} max-w-none fill-current text-amber-400`}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d={STAR_PATH} />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## 5. Integration Points

1. **`QuizRatingWidget.tsx`:**
   - In the read-only summary card displayed to non-attending members and visitors.
   - In the collective footer under interactive voting: replace static `★` text with the smooth visual `ReadOnlyStarRating` component.
2. **`QuizCard.tsx` (Past Quizzes):**
   - Can optionally display compact stars next to the numeric badge (`★ 4.3`) for completed events.
3. **Future Backlog Item 12 (Smart Historical Suggestions):**
   - Provide visual star rating for prior editions when creating or editing a quiz.

---

## 6. Verification & Test Plan

1. **Pure Unit Tests (`tests/unit/starRating.test.ts`):**
   - Clamping bounds: `rating < 0` returns `0`, `rating > maxStars` returns `maxStars`.
   - Fill percentage computation:
     - Rating `0`: all stars `0%`.
     - Rating `5`: all stars `100%`.
     - Rating `4.35`: indices 0–3 return `100%`, index 4 returns `35%`.
     - Rating `2.5`: index 0–1 return `100%`, index 2 returns `50%`, indices 3–4 return `0%`.
2. **Visual & Lint Verification:**
   - Run `npm run check:all` (Typecheck, Vitest, ESLint, Prettier, Audit-CI, Secretlint).
