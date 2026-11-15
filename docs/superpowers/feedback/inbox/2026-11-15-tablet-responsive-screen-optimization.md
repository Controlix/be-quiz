# Feedback Intake: Responsive Tablet & Smartphone Rotation Layout Optimization

- **Date:** 2026-11-15
- **Source:** User Feedback / Testing Remark
- **Reporter:** Marc (Admin)
- **Status:** Triaged into `docs/roadmap.md`

---

## Feedback Description

> _"Progressive web page, so the screen usage is optimized when i rotate my smartphone or when i use a tablet."_

---

## Problem & Context

1. **Smartphone Landscape Rotation:**
   - When a user rotates their smartphone from portrait to landscape orientation, the viewport height shrinks significantly while the horizontal width expands.
   - The current UI layout is primarily optimized for a fixed narrow portrait container (`max-w-md`), resulting in excessive vertical scrolling, headers/navbars consuming disproportionate vertical space, and large unused horizontal margins.

2. **Tablet & Foldable Viewports (iPad, Android Tablets):**
   - On tablet-class viewports (typically 768px to 1024px+ width), single-column mobile layouts leave significant empty space on either side, failing to leverage the expanded screen real estate.
   - Core screens—such as the quiz detail view with lineup/reserves and the quiz list—would greatly benefit from responsive multi-column layouts (e.g., side-by-side quiz overview and lineup roster).

---

## Scope & Target Requirements

- **Responsive Multi-Column Breakpoints:**
  - Adapt `/quizzes` card lists to responsive multi-column grids on tablet/landscape screens (`md:grid-cols-2`, `lg:grid-cols-3`).
  - Adapt `/quizzes/[id]` to a split-view layout on wider screens (`md:grid md:grid-cols-12 md:gap-6` with quiz details/actions on one side and team lineup/reserves on the other).
- **Landscape Screen Optimization:**
  - Adjust sticky headers, action toolbars, and modal dialogs to be compact when viewport height is limited (`landscape:` or `max-h` media queries).
- **PWA Meta & Manifest Configuration:**
  - Ensure the PWA manifest orientation settings (`manifest.json` / Next.js metadata) allow flexible rotation (`"orientation": "any"` or `"natural"`) without locking portrait mode.
