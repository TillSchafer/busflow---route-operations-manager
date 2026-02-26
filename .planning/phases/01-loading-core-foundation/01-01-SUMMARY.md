---
phase: 01-loading-core-foundation
plan: 01
subsystem: loading
tags: [react, loading, async, lifecycle]
requires: []
provides:
  - token/ref-count loading lifecycle engine
  - global LoadingProvider + useLoading API
  - contract tests for cleanup, overlap, and reveal delay
affects: [route-loading, auth-loading, full-page-loader]
tech-stack:
  added: []
  patterns:
    - external-store backed loading engine via useSyncExternalStore
    - token-based async lifecycle with idempotent stop
key-files:
  created:
    - src/shared/loading/loading-types.ts
    - src/shared/loading/loading-engine.ts
    - src/shared/loading/LoadingProvider.tsx
    - src/shared/loading/index.ts
    - src/shared/loading/LoadingProvider.test.tsx
  modified: []
key-decisions:
  - "Engine-level reveal delay fixed at 150ms with cancellation when active operations resolve early."
  - "Token ownership is required for stop() to avoid concurrency cleanup races."
  - "LoadingProvider uses useSyncExternalStore with cached engine snapshots for stable React updates."
patterns-established:
  - "Pattern: runWithLoading() wrapper guarantees cleanup via finally."
  - "Pattern: latest active operation drives global display message/progress selection."
requirements-completed: [LOAD-04, LOAD-02]
duration: 16min
completed: 2026-02-26
---

# Phase 1 Plan 01: Loading Lifecycle Foundation Summary

**Token-based global loading lifecycle with delayed reveal and guaranteed async cleanup for success, error, and overlap flows**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-26T23:06:00Z
- **Completed:** 2026-02-26T23:22:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added a centralized loading engine that tracks active operations by token and enforces idempotent stop semantics.
- Added `runWithLoading` to standardize lifecycle cleanup across success/error paths with `finally`-based stop handling.
- Added `LoadingProvider` and hook API plus regression tests covering cleanup, overlap, and reveal-delay cancellation behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define loading contracts and token lifecycle engine** - `91867f6` (feat)
2. **Task 2: Implement LoadingProvider and useLoading hook** - `d5fced1` (feat)
3. **Task 3: Add provider contract tests for cleanup and overlap behavior** - `a8229f9` (test)

## Files Created/Modified
- `src/shared/loading/loading-types.ts` - loading contract types and engine configuration interfaces.
- `src/shared/loading/loading-engine.ts` - token/ref-count lifecycle engine, reveal timer control, and display derivation.
- `src/shared/loading/LoadingProvider.tsx` - React context bridge exposing loading state/actions.
- `src/shared/loading/index.ts` - public exports for loading subsystem.
- `src/shared/loading/LoadingProvider.test.tsx` - behavior tests for cleanup, concurrency, and delay cancellation.

## Decisions Made
- Kept reveal behavior centralized in the engine (`150ms`) so UI consumers stay declarative.
- Added rapid-resume window support in the engine to bias toward showing loading in back-to-back async bursts.
- Treated snapshot-caching in the engine as required runtime behavior (not test-only) to keep `useSyncExternalStore` stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stabilized external-store snapshots for React subscription correctness**
- **Found during:** Task 3 (provider contract tests)
- **Issue:** `useSyncExternalStore` hit a maximum update depth loop because `getSnapshot()` returned a fresh object each read.
- **Fix:** Added cached snapshot state in `LoadingEngine` and refreshed it only during emit cycles.
- **Files modified:** `src/shared/loading/loading-engine.ts`
- **Verification:** `npm run test -- src/shared/loading/LoadingProvider.test.tsx`
- **Committed in:** `a8229f9`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was required for runtime correctness and aligned with planned provider architecture. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core loading lifecycle and provider contract are in place for canonical full-page loading UI implementation.
- Wave 2 can safely consume `useLoading` state and lifecycle methods without duplicating async cleanup logic.

---
*Phase: 01-loading-core-foundation*
*Completed: 2026-02-26*
