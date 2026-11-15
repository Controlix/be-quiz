## Read-Only Fractional Star Rating Component (React + Tailwind CSS)

### Overview

A read-only star rating component that renders arbitrary decimal ratings (e.g., `4.35` out of `5`) by layering a percentage-clipped foreground star over a full-width background star.

### Architecture & Mechanics

- **Input Clamping:** `rating` is clamped to `[0, maxStars]` via `Math.max(0, Math.min(rating, maxStars))`.
- **Per-Star Fill Calculation:** For each zero-based star `index`, the fill percentage is computed as:
  `Math.max(0, Math.min(1, clampedRating - index)) * 100`
  (e.g., `4.35` yields `100%` for indices `0–3` and `35%` for index `4`).
- **Two-Layer SVG Overlay:**
  1. **Base layer:** A `relative` wrapper containing a gray (`text-gray-300`) full-star SVG.
  2. **Overlay layer:** Rendered when `fillPercentage > 0`. Positioned with `absolute inset-y-0 left-0 overflow-hidden` and an inline `style={{ width: `${fillPercentage}%` }}` (using inline `style` instead of dynamic Tailwind arbitrary width classes so Tailwind JIT does not purge uncompiled values).
  3. **Preventing SVG Squishing:** The inner yellow (`text-yellow-400`) SVG includes `max-w-none` and fixed explicit dimensions (`size`) so it maintains full icon width inside the narrowed clipping container.
- **Accessibility:** The outer container uses `role="img"` and `aria-label="${clampedRating} out of ${maxStars} stars"`, while decorative SVGs set `aria-hidden="true"`.

### Props

- `rating: number` (required) — Decimal score to display.
- `maxStars?: number` (default: `5`) — Total number of stars rendered.
- `size?: string` (default: `'w-5 h-5'`) — Tailwind width/height utility classes applied to each star container and SVG.

### Reference Implementation

```tsx
import React from "react";

interface ReadOnlyStarRatingProps {
  rating: number;
  maxStars?: number;
  size?: string;
}

const STAR_PATH =
  "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

export function ReadOnlyStarRating({
  rating,
  maxStars = 5,
  size = "w-5 h-5",
}: ReadOnlyStarRatingProps) {
  const clampedRating = Math.max(0, Math.min(rating, maxStars));

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${clampedRating} out of ${maxStars} stars`}
    >
      {Array.from({ length: maxStars }, (_, index) => {
        const fillPercentage = Math.max(0, Math.min(1, clampedRating - index)) * 100;

        return (
          <div key={index} className={`relative ${size}`}>
            <svg
              className={`${size} fill-current text-gray-300`}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d={STAR_PATH} />
            </svg>

            {fillPercentage > 0 && (
              <div
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillPercentage}%` }}
              >
                <svg
                  className={`${size} max-w-none fill-current text-yellow-400`}
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
