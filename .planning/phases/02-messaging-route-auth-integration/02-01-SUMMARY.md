---
phase: 02-messaging-route-auth-integration
plan: 01
subsystem: ui
tags: [loading, messaging, fallback, route-auth]
requires:
  - phase: 01-loading-core-foundation
    provides: global loading engine/provider infrastructure
provides:
  - scoped loading message registry and resolver
  - message-key support in loading start/update contracts
  - engine-level fallback copy policy integration
affects: [route-loading-copy, auth-loading-copy, action-loading-copy]
tech-stack:
  added: []
  patterns:
    - explicit loading message overrides keyed defaults
    - unresolved keys always degrade to `Lade...`
key-files:
  created:
    - src/shared/loading/loading-messages.ts
    - src/shared/loading/loading-messages.test.ts
  modified:
    - src/shared/loading/loading-types.ts
    - src/shared/loading/loading-engine.ts
    - src/shared/loading/index.ts
key-decisions:
  - "Message resolution order is explicit message > scoped messageKey > fallback `Lade...`."
  - "Message-key support is added as non-breaking optional fields on start/update contracts."
patterns-established:
  - "Pattern: centralized loading copy policy lives in a dedicated resolver module, not in UI components."
requirements-completed: [LOAD-03]
duration: 7min
completed: 2026-02-28
---

# Phase 2 Plan 01: Scoped Loading Message Policy Summary

**Scoped loading copy now resolves through a centralized message policy with deterministic `Lade...` fallback and message-key support.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-28T10:13:00Z
- **Completed:** 2026-02-28T10:20:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added shared loading message registry and resolver for route/auth/action/system scopes.
- Extended loading contracts and engine state derivation to support optional `messageKey` inputs.
- Added focused unit tests covering precedence and fallback behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Introduce scoped loading message resolver** - `8d5c657` (feat)
2. **Task 2: Integrate resolver into loading engine display state** - `c7287f7` (feat)
3. **Task 3: Add resolver contract tests** - `f4956f5` (test)

## Files Created/Modified
- `src/shared/loading/loading-messages.ts` - scoped registry plus resolver policy utilities.
- `src/shared/loading/loading-types.ts` - adds optional `messageKey` support.
- `src/shared/loading/loading-engine.ts` - resolves display message via policy.
- `src/shared/loading/index.ts` - exports resolver utilities.
- `src/shared/loading/loading-messages.test.ts` - verifies precedence and fallback behavior.

## Decisions Made
- Keep fallback copy centralized (`Lade...`) so callers and UI don't duplicate fallback logic.
- Allow scoped keys for future action-specific copy without forcing immediate caller migration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route/auth integrations can now switch from hardcoded fallback strings to policy-driven message keys.
- Message resolver coverage is in place to support refactors in 02-02 and 02-03 safely.

---
*Phase: 02-messaging-route-auth-integration*
*Completed: 2026-02-28*
