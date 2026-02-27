---
phase: 01-loading-core-foundation
plan: 05
subsystem: integration
tags: [busflow, routing, loading, cleanup]
requires:
  - phase: 01-04
    provides: canonical loader visuals and spinner path alignment
provides:
  - removal of BusFlow-local legacy loading screen variant
  - BusFlow bootstrap data flow bridged into shared loading lifecycle
  - regression assertion against `Lade BusFlow Daten...` legacy copy
affects: [busflow-startup, route-transition-consistency, loading-regressions]
tech-stack:
  added: []
  patterns:
    - feature bootstrap loaders should use shared runWithLoading instead of local full-screen branches
    - legacy copy checks are enforced at integration-test level
key-files:
  created: []
  modified:
    - src/apps/busflow/BusflowApp.tsx
    - src/apps/busflow/hooks/useBusflowData.ts
    - src/app/router/AppRouter.loading.test.tsx
    - components/ui/loader-15.tsx
key-decisions:
  - "BusFlow startup no longer owns a dedicated full-page loader; global loading surface is the only blocking UI."
  - "BusFlow bootstrap fetches run via shared `runWithLoading` using `route` scope for consistent transition treatment."
  - "Legacy loading copy checks were added to router integration regression tests to prevent reintroduction."
patterns-established:
  - "Pattern: remove route-local loading screens and migrate initialization fetches into shared loading manager."
  - "Pattern: keep legacy loading copy assertions in integration tests as anti-regression guardrails."
requirements-completed: [FLOW-01, FLOW-02, QUAL-01]
duration: 14min
completed: 2026-02-27
---

# Phase 1 Plan 05: BusFlow Canonical Loader Consolidation Summary

**BusFlow startup now relies on one canonical loading overlay by removing local legacy loader UI and routing bootstrap fetches through shared loading lifecycle APIs.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-27T11:30:00Z
- **Completed:** 2026-02-27T11:44:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Removed the in-page BusFlow legacy loading screen (`Leaf` + `Lade BusFlow Daten...`) so users no longer see mixed loader variants.
- Integrated BusFlow bootstrap data loading with `runWithLoading` and `route` scope, keeping start/stop lifecycle cleanup centralized.
- Extended router integration regression checks to ensure legacy loader copy is absent while canonical loading manager behavior remains intact.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove BusFlow-local full-screen legacy loader branch** - `ce1a781` (feat)
2. **Task 2: Bridge BusFlow bootstrap loading into shared lifecycle API** - `7555d36` (feat)
3. **Task 3: Add integration regression coverage for canonical-only loader behavior** - `18c585c` (test)

## Files Created/Modified
- `src/apps/busflow/BusflowApp.tsx` - removed local full-screen loading branch and legacy copy path.
- `src/apps/busflow/hooks/useBusflowData.ts` - wraps startup fetch sequence in shared `runWithLoading`.
- `src/app/router/AppRouter.loading.test.tsx` - asserts legacy BusFlow loading copy does not appear in loading integration.
- `components/ui/loader-15.tsx` - typing update for prop passthrough to satisfy lint gate discovered during verification.

## Decisions Made
- Keep a single blocking loader surface globally rather than allowing feature-local full-screen loaders.
- Treat BusFlow bootstrap as route-scoped loading for white transition background consistency.
- Keep compatibility `loading` state in hook return while decoupling visible loader UI from feature component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Loader component prop typing violated lint rule**
- **Found during:** Task 2 verification (`npm run typecheck && npm run lint`)
- **Issue:** `components/ui/loader-15.tsx` used an empty interface extension and failed ESLint (`no-empty-object-type`).
- **Fix:** Converted prop interface to a type alias with `React.HTMLAttributes<HTMLDivElement>`.
- **Files modified:** `components/ui/loader-15.tsx`
- **Verification:** `npm run typecheck && npm run lint`
- **Committed in:** `7555d36`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Deviation was a lint-compliance fix with no scope expansion.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT-reported mixed-loader issue is addressed in BusFlow route flow and regression-protected.
- Phase-level re-verification can now focus on confirming visual expectations in-browser (white/transparent backgrounds + spinner style) after these gap fixes.

---
*Phase: 01-loading-core-foundation*
*Completed: 2026-02-27*
