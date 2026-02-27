---
phase: 01-loading-core-foundation
plan: 04
subsystem: ui
tags: [loading, spinner, route-transition, styling]
requires:
  - phase: 01-01
    provides: loading lifecycle and reveal-delay contract
  - phase: 01-02
    provides: canonical full-page loading component baseline
  - phase: 01-03
    provides: app-root loading provider and route/auth bridge wiring
provides:
  - aligned canonical loader visuals (minimal text + contextual backdrop variants)
  - loader-15 spinner implementation in shared loading stack
  - regression tests for spinner path and backdrop behavior by scope
affects: [shared-loading-ui, route-loading-perception, hydration-experience]
tech-stack:
  added: [styled-components]
  patterns:
    - loading backdrop style derives from loading scope (route/auth => white, others => transparent)
    - canonical loader copy stays concise with optional determinate percent only
key-files:
  created: []
  modified:
    - src/shared/loading/loading-ui.ts
    - src/shared/loading/FullPageLoadingScreen.tsx
    - src/shared/loading/LoadingSpinner.tsx
    - src/shared/loading/index.ts
    - components/ui/loader-15.tsx
    - src/shared/loading/FullPageLoadingScreen.test.tsx
    - package.json
    - package-lock.json
key-decisions:
  - "Route/auth loading contexts now default to a near-white full-screen backdrop, while other scopes stay transparent/faint."
  - "Secondary helper copy was removed so the canonical loader keeps concise message-first communication."
  - "The requested loader-15 component is now the primary spinner path, with icon fallback retained for resilience."
patterns-established:
  - "Pattern: derive loading presentation from shared scope metadata instead of per-screen custom overlays."
  - "Pattern: lock visual loading contract with focused UI tests (copy, backdrop variant, spinner source)."
requirements-completed: [LOAD-01, LOAD-03, FLOW-01]
duration: 18min
completed: 2026-02-27
---

# Phase 1 Plan 04: Canonical Loader Alignment Summary

**Canonical loading visuals now use the agreed minimal copy, contextual white/transparent backdrops, and the requested loader-15 spinner path.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-02-27T11:24:00Z
- **Completed:** 2026-02-27T11:42:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Reworked `FullPageLoadingScreen` into a cleaner minimal layout and removed the extra helper line so loading copy stays focused (`Lade...` + optional `%`).
- Introduced scope-aware backdrop variants so route/auth transitions can use a white screen treatment while other loading flows keep a faint transparent overlay.
- Integrated the provided `loader-15` component implementation and added test coverage to prevent spinner/style drift.

## Task Commits

Each task was committed atomically:

1. **Task 1: Refine canonical loading surface to agreed minimal style** - `54ec5f8` (feat)
2. **Task 2: Normalize spinner source to requested loader-15 implementation** - `f643d45` (feat)
3. **Task 3: Expand canonical loading UI regression tests** - `5b7d6bd` (test)

## Files Created/Modified
- `src/shared/loading/loading-ui.ts` - adds scope-based backdrop/content variant helpers.
- `src/shared/loading/FullPageLoadingScreen.tsx` - renders minimal spinner/message surface with contextual backdrop behavior.
- `src/shared/loading/LoadingSpinner.tsx` - routes primary spinner rendering through `loader-15`.
- `components/ui/loader-15.tsx` - replaced with installed loader implementation and normalized sizing/colors for canonical usage.
- `src/shared/loading/FullPageLoadingScreen.test.tsx` - now asserts helper-copy removal, spinner path, and backdrop variant mapping.
- `package.json` / `package-lock.json` - include `styled-components` dependency required by loader implementation.

## Decisions Made
- Keep loading messaging compact and avoid generic secondary helper copy.
- Use shared loading `scope` to decide white versus transparent fullscreen background behavior.
- Favor canonical spinner source parity with the provided loader component over project-local placeholder styling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shared loading exports broke after UI helper rename**
- **Found during:** Task 1 (loader UI refinement)
- **Issue:** `loadingCardClassName` export was removed but still referenced by `src/shared/loading/index.ts`, breaking typecheck.
- **Fix:** Updated shared exports to new helper names (`resolveBackdropVariant`, `loadingBackdropClassName`, `loadingContentClassName`).
- **Files modified:** `src/shared/loading/index.ts`
- **Verification:** `npm run typecheck`
- **Committed in:** `54ec5f8`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Deviation was a direct refactor follow-up and required for compile-safe delivery.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Loader visuals and spinner source are now aligned with UAT feedback at the shared component level.
- Remaining gap work can now focus on eliminating BusFlow’s local legacy loading screen and routing all data bootstrap through the shared loading lifecycle.

---
*Phase: 01-loading-core-foundation*
*Completed: 2026-02-27*
