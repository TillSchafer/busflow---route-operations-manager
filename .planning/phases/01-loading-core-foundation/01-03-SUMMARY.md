---
phase: 01-loading-core-foundation
plan: 03
subsystem: integration
tags: [react-router, auth, loading, app-shell]
requires:
  - phase: 01-01
    provides: loading lifecycle provider contract
  - phase: 01-02
    provides: canonical full-page loading screen UI
provides:
  - root-level loading provider/screen mounting in app shell
  - auth and suspense route loading bridge wiring
  - router-level regression test for legacy fallback removal and cleanup
affects: [app-providers, auth-context, routing]
tech-stack:
  added: []
  patterns:
    - bridge components map external loading sources into centralized loading manager
    - suspense fallback signals loading state without rendering local fallback UI
key-files:
  created:
    - src/shared/loading/AppLoadingBridge.tsx
    - src/app/router/AppRouter.loading.test.tsx
  modified:
    - src/app/providers/AppProviders.tsx
    - src/app/router/AppRouter.tsx
    - src/shared/auth/AuthContext.tsx
    - src/shared/loading/index.ts
    - src/shared/loading/loading-engine.ts
    - src/shared/loading/loading-types.ts
    - src/shared/loading/LoadingProvider.tsx
    - src/shared/loading/LoadingProvider.test.tsx
    - src/shared/loading/FullPageLoadingScreen.test.tsx
key-decisions:
  - "Auth and route transitions now signal loading through bridge components, not local full-page fallback UI."
  - "AuthProvider now always renders children so global loading orchestration can manage hydration state consistently."
  - "Short-variant timing is now engine-managed for deterministic behavior and lint-safe provider rendering."
patterns-established:
  - "Pattern: use bridge signal components for external async sources (auth/suspense) into loading manager."
  - "Pattern: remove route-local full-page loaders; keep one canonical loading surface in app providers."
requirements-completed: [LOAD-01, LOAD-04]
duration: 18min
completed: 2026-02-26
---

# Phase 1 Plan 03: App Shell Loading Integration Summary

**App-root loading orchestration integrated across providers, auth hydration, and route suspense fallbacks with cleanup-safe bridge behavior**

## Performance

- **Duration:** 18 min
- **Started:** 2026-02-26T23:04:00Z
- **Completed:** 2026-02-26T23:22:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Mounted `LoadingProvider` + `FullPageLoadingScreen` in root provider stack so one canonical loading surface is always available.
- Replaced local `RouteFallback` rendering in `AppRouter` with bridge-driven auth and suspense loading signals.
- Added router integration regression coverage confirming legacy fallback copy removal and loading cleanup on unmount.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount loading provider and canonical screen in app root** - `eef8619` (feat)
2. **Task 2: Replace baseline route/auth fallback wiring with loading bridge** - `1ba4413` (feat)
3. **Task 3: Add integration-focused regression test for canonical fallback wiring** - `2cff67d` (test)

## Files Created/Modified
- `src/app/providers/AppProviders.tsx` - root provider composition now includes loading provider/screen.
- `src/shared/loading/AppLoadingBridge.tsx` - auth + route loading signal bridge components.
- `src/app/router/AppRouter.tsx` - removed local route fallback UI usage, wired suspense/auth signals.
- `src/shared/auth/AuthContext.tsx` - children now render during hydration to enable global loading orchestration.
- `src/shared/loading/loading-engine.ts` and `loading-types.ts` - engine-managed short variant state and snapshot shape updates.
- `src/shared/loading/LoadingProvider.tsx` - action references stabilized; provider consumes engine short-variant state.
- `src/shared/loading/LoadingProvider.test.tsx` and `FullPageLoadingScreen.test.tsx` - lint-safe ref capture and updated integration behavior.
- `src/app/router/AppRouter.loading.test.tsx` - integration regression coverage for loading bridge path.

## Decisions Made
- Removed route-local full-page fallback rendering so only shared loading surface controls full-page loading UX.
- Used bridge components (`AppLoadingBridge`, `RouteLoadingFallback`) to avoid direct loading logic inside router views.
- Hardened loading state handling for React purity/lint constraints (no impure render-time calculations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed provider/action stability for bridge effect lifecycle**
- **Found during:** Task 2 (bridge integration)
- **Issue:** loading context action functions changed per render, which can retrigger effect-managed start/stop flows.
- **Fix:** memoized action methods by engine reference and separated snapshot-driven value fields.
- **Files modified:** `src/shared/loading/LoadingProvider.tsx`
- **Verification:** `npm run typecheck && npm run lint`
- **Committed in:** `1ba4413`

**2. [Rule 1 - Bug] Moved short-variant timing to engine-managed state**
- **Found during:** Task 2 (lint/type hardening)
- **Issue:** provider computed short-variant state via `Date.now()` in render, violating purity lint rule and making timing transitions implicit.
- **Fix:** added engine-managed `isShortVisible` state with threshold timer and snapshot export.
- **Files modified:** `src/shared/loading/loading-engine.ts`, `src/shared/loading/loading-types.ts`, `src/shared/loading/LoadingProvider.tsx`
- **Verification:** `npm run typecheck && npm run lint`
- **Committed in:** `1ba4413`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Deviations improved lifecycle correctness and ensured stable bridge behavior without scope expansion.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 foundation is fully integrated at app root with canonical loading wiring for baseline auth and suspense route paths.
- Phase 2 can now focus on scoped message registry and broader route/auth behavior standardization on top of shared infrastructure.

---
*Phase: 01-loading-core-foundation*
*Completed: 2026-02-26*
