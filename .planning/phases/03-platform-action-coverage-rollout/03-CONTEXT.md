# Phase 3: Platform Action Coverage Rollout - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure all critical user-triggered mutation flows in the existing product scope (save/delete/invite/import/profile-security) use the shared loading system consistently, keep global loading visibility correct during overlap, and provide a maintained async coverage inventory artifact.

This phase clarifies how to roll out loading across existing flows; it does not add new product capabilities.

</domain>

<decisions>
## Implementation Decisions

### Action Wrapper Contract
- Unified loading is mandatory for all critical mutation actions in this phase: save/delete/invite/import/profile-security flows across AppRouter, TeamAdmin, PlatformAdmin, and Busflow settings/action paths.
- Introduce a shared reusable action helper/hook built on top of `useLoading().runWithLoading` rather than duplicating ad hoc calls in each handler.
- Wrapped actions must provide an explicit action loading message key (no silent omission).
- Global full-page loading behavior should remain blocking by default for wrapped actions.

### Loading Message Policy
- Expand action message coverage from the current generic set to domain-specific keys (including invite and security actions, and action-level coverage needed for rollout clarity).
- Keep message tone/style aligned with existing German concise verb phrases (`Lade...`, `Speichere...`, `Loesche...`, `Importiere...` pattern).
- Profile security and invitation flows should use explicit task text (not generic fallback copy).
- If a key is missing/unknown, user fallback remains `Lade...`, but development should emit a warning so gaps are fixed.

### Concurrent-Action Behavior
- Keep current precedence rule where the newest active operation controls global loading message/progress display.
- Keep strict token/reference-count semantics: global loading hides only after all active operations settle.
- If one concurrent action fails, keep global loading active for remaining operations; failures are communicated via existing toast/error surfaces.
- Keep ProgressViewport and global full-page loading together for long-running jobs so users retain detailed progress without losing system-wide loading consistency.

### Async Coverage Inventory Governance
- Maintain a phase-local inventory file: `.planning/phases/03-platform-action-coverage-rollout/03-ASYNC-FLOW-INVENTORY.md`.
- Inventory rows represent user-triggered action flows (not only modules or raw endpoints).
- Use status model: `Not covered` / `Covered` / `Verified`.
- Inventory updates are required in the same change when a flow is wired to unified loading (not deferred to phase-end cleanup).

### Claude's Discretion
- Exact naming and file placement of the new wrapper/helper, as long as it is reusable and used consistently.
- Exact action message key taxonomy details beyond the locked requirements above.
- Exact inventory table columns/metadata beyond required flow granularity and status model.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/loading/LoadingProvider.tsx`: exposes `useLoading()` with `runWithLoading`, `start`, `update`, `stop`.
- `src/shared/loading/loading-messages.ts`: centralized scoped message registry and fallback behavior.
- `src/shared/loading/loading-engine.ts`: built-in token lifecycle, overlap handling, and newest-operation display precedence.
- `src/shared/components/ProgressProvider.tsx` + `src/shared/components/ProgressViewport.tsx`: existing detailed progress surface for long-running import/delete jobs.
- `src/shared/components/ToastProvider.tsx`: established user feedback channel for success/error outcomes.

### Established Patterns
- Async UI handlers use `try/catch/finally` with local `isSubmitting` flags and toast feedback.
- Domain API calls are already centralized behind `*.api.ts` modules (`PlatformAdminApi`, `TeamAdminApi`, `ProfileSecurityApi`, `BusFlowApi`).
- Loading is already integrated for route/auth bootstrap via `AppLoadingBridge` and `RouteLoadingFallback`, so Phase 3 can extend the same system to action flows.

### Integration Points
- `src/app/router/AppRouter.tsx`: profile avatar save, email-change request, password-reset request handlers.
- `src/pages/TeamAdmin.tsx`: invite, role update, delete user, invitation management actions.
- `src/pages/PlatformAdmin.tsx`: account create/update/archive/reactivate/delete/trial actions.
- `src/apps/busflow/BusflowApp.tsx`: route save/delete and settings mutations (bus types/workers/contacts/import/map defaults).
- `src/apps/busflow/components/settings/CustomerManagementPanel.tsx`: CSV import and bulk delete flows already carrying progress hooks that must coexist with global loading.

</code_context>

<specifics>
## Specific Ideas

- Preserve current global loading concurrency semantics (newest active operation visible) while extending coverage.
- Keep both global loading and detailed progress overlays active for long-running import/delete operations.
- Introduce explicit loading copy for invitation and security-related actions to avoid generic or ambiguous feedback.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-platform-action-coverage-rollout*
*Context gathered: 2026-02-28*
