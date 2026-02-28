# Phase 3: Platform Action Coverage Rollout - Research

**Researched:** 2026-02-28  
**Domain:** React async action orchestration with shared loading lifecycle  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-03 | Critical mutation actions (save, delete, invite, import, profile security actions) trigger the shared loading screen consistently. | Add one shared action helper on top of `useLoading()` and apply it across `AppRouter`, `TeamAdmin`, `PlatformAdmin`, and `BusflowApp` mutation handlers with explicit action message keys. |
| FLOW-04 | Concurrent async actions are handled correctly so loading visibility remains accurate until all active operations are complete. | Reuse existing token/ref-count lifecycle in `LoadingEngine`; avoid boolean loader states for global visibility; keep overlapping operations independently scoped and auto-cleaned via wrapper `finally` semantics. |
| QUAL-03 | A documented async flow inventory confirms no loading-prone user flow is left uncovered. | Create and maintain phase-local inventory file with flow-level rows and `Not covered` / `Covered` / `Verified` states, updated in the same changes that wire loading. |
</phase_requirements>

## Summary

Phase 2 already established the required platform primitives: token-based loading lifecycle, `runWithLoading` cleanup semantics, scoped message resolution, and route/auth integration. Phase 3 is primarily an application rollout problem, not a new infrastructure build. The codebase currently has many mutation handlers with local `isSubmitting`/`isDeleting` flags and toast flows, but almost none of these handlers call the shared loading system.

The highest-leverage move is to add one reusable action helper/hook that enforces `scope: 'action'` plus required `messageKey`, then migrate targeted handlers to that helper while preserving existing local busy flags and toast behavior. This keeps UX details intact while adding global loading consistency and preserving concurrency correctness via the existing `LoadingEngine`.

For long-running import/delete flows, ProgressViewport exists but is currently layered below the full-page loader (`z-[1490]` vs `z-[1600]`). To satisfy the locked decision to keep both together, Phase 3 plans should include explicit layering/visibility behavior so progress remains observable during global action loading.

**Primary recommendation:** Implement a strict `useActionLoading` abstraction (required key, development warning on unknown keys, optional progress updates), then execute a flow-by-flow rollout with an inventory file that is updated in each migration PR.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.3 | Hook-based action helpers and handler composition | Existing app architecture and provider model are React-first. |
| LoadingProvider/LoadingEngine (`src/shared/loading/*`) | in-repo | Global loading lifecycle and concurrency correctness | Already production-integrated for route/auth with tests. |
| react-router-dom | ^6.26.2 | Router-level composition where profile/admin/busflow handlers live | Existing route structure is the rollout surface. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ProgressProvider (`src/shared/components/ProgressProvider.tsx`) | in-repo | Long-running operation progress channel | Import/bulk-delete actions that emit progress callbacks. |
| ToastProvider (`src/shared/components/ToastProvider.tsx`) | in-repo | Success/error feedback | Keep existing action outcome UX while adding global loader. |
| vitest + RTL | ^4.0.18 / ^16.3.2 | Action helper and integration regression coverage | Add/extend tests for required message keys and overlap behavior in action paths. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared helper over `runWithLoading` | Manual `start`/`stop` in each handler | High duplication and cleanup risk across many flows. |
| Existing loading message registry (`loading-messages.ts`) | Inline per-handler loading text | Reintroduces divergence and weakens inventory/governance. |

**Installation:**
```bash
# No new packages required for Phase 3.
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── shared/loading/
│   ├── action-loading.ts            # new helper/hook for mutation handlers
│   ├── loading-messages.ts          # expanded action message keys
│   └── loading-messages.test.ts     # message coverage + fallback tests
├── app/router/AppRouter.tsx         # profile-security actions wrapped
├── pages/TeamAdmin.tsx              # invite/delete/role flows wrapped
├── pages/PlatformAdmin.tsx          # owner mutation flows wrapped
└── apps/busflow/BusflowApp.tsx      # save/delete/import/settings flows wrapped
```

### Pattern 1: Strict action wrapper with required `messageKey`
**What:** One helper that delegates to `runWithLoading`, hard-sets `scope: 'action'`, and requires `messageKey` on every call.
**When to use:** Every user-triggered mutation action in phase scope.
**Example:**
```typescript
// action-loading.ts
import { useCallback } from 'react';
import { useLoading } from './LoadingProvider';
import { resolveScopedLoadingMessage } from './loading-messages';

type ActionKey = string;

export const useActionLoading = () => {
  const { runWithLoading } = useLoading();

  return useCallback(
    async <T>(operation: () => Promise<T> | T, messageKey: ActionKey): Promise<T> => {
      if (!messageKey.trim()) {
        throw new Error('Action loading messageKey is required.');
      }
      if (import.meta.env.DEV && !resolveScopedLoadingMessage('action', messageKey)) {
        console.warn(`[loading] Unknown action message key: ${messageKey}`);
      }
      return runWithLoading(operation, { scope: 'action', messageKey });
    },
    [runWithLoading]
  );
};
```

### Pattern 2: Keep local busy flags and toasts; add global loading around the same mutation
**What:** Preserve existing component-level flags for button states/dialog labels while wrapping async operation in global action loading.
**When to use:** Existing handlers already using `setIsSubmitting` + toast flows.
**Example:**
```typescript
const runAction = useActionLoading();

const handleInviteEmployee = async () => {
  if (!activeAccountId || !accountIsWritable) return;
  setIsInviting(true);
  try {
    await runAction(
      async () => {
        await TeamAdminApi.inviteTeamMember({ accountId: activeAccountId, email: inviteEmail.trim(), role: inviteRole });
        await loadData();
      },
      'action.team.invite.send'
    );
    pushToast({ type: 'success', title: 'Einladung gesendet', message: 'Mitarbeiter wurde eingeladen.' });
  } finally {
    setIsInviting(false);
  }
};
```

### Pattern 3: Progress + global loader coexistence for long-running jobs
**What:** Use explicit loading token (`start/update/stop`) when progress callbacks are available, so full-page loading and progress are synchronized.
**When to use:** CSV import and bulk delete operations.
**Example:**
```typescript
const { start, update, stop } = useLoading();

const token = start({ scope: 'action', messageKey: 'action.customer.import.commit', progress: { current: 0, total } });
try {
  await onCommitCustomerImport(preview, resolutions, ({ current, total }) => {
    update(token, { progress: { current, total } });
    updateProgress(progressId, { current, total, message: `${current} von ${total} importiert` });
  });
} finally {
  stop(token);
}
```

### Anti-Patterns to Avoid
- **Ad-hoc direct `runWithLoading` calls in each file:** loses consistent key enforcement and warning behavior.
- **Replacing all local busy state with global loading only:** regresses button/dialog affordances currently driven by local flags.
- **Wrapping only partial action steps:** mutation done without wrapping follow-up refresh can cause misleading loader/message transitions.
- **Ignoring z-index layering for progress jobs:** violates locked requirement to keep detailed progress visible with global loading.

## Async Flow Coverage Baseline

Initial baseline for `03-ASYNC-FLOW-INVENTORY.md` (current state before rollout):

| Domain | User Flow | Location | Suggested Key | Current Status |
|--------|-----------|----------|---------------|----------------|
| Profile | Save avatar | `src/app/router/AppRouter.tsx` (`handleProfileAvatarSave`) | `action.profile.avatar.save` | Not covered |
| Profile | Request email change | `src/app/router/AppRouter.tsx` (`handleProfileEmailChangeRequest`) | `action.profile.email.change` | Not covered |
| Profile | Request password reset | `src/app/router/AppRouter.tsx` (`handleProfilePasswordResetRequest`) | `action.profile.password.reset` | Not covered |
| Team Admin | Invite employee | `src/pages/TeamAdmin.tsx` (`handleInviteEmployee`) | `action.team.invite.send` | Not covered |
| Team Admin | Update member role | `src/pages/TeamAdmin.tsx` (`handleUpdateMembershipRole`) | `action.team.membership.update` | Not covered |
| Team Admin | Delete user hard | `src/pages/TeamAdmin.tsx` (`handleDeleteUserHard`) | `action.team.user.delete` | Not covered |
| Team Admin | Delete invitation | `src/pages/TeamAdmin.tsx` (`handleDeleteInvitation`) | `action.team.invitation.delete` | Not covered |
| Team Admin | Resend invitation | `src/pages/TeamAdmin.tsx` (`handleResendInvitation`) | `action.team.invitation.resend` | Not covered |
| Platform Owner | Create account + invite admin | `src/pages/PlatformAdmin.tsx` (`handleCreateAccountAndInviteAdmin`) | `action.owner.account.create` | Not covered |
| Platform Owner | Save account edits | `src/pages/PlatformAdmin.tsx` (`handleSaveEdit`) | `action.owner.account.save` | Not covered |
| Platform Owner | Archive account | `src/pages/PlatformAdmin.tsx` (`handleArchive`) | `action.owner.account.archive` | Not covered |
| Platform Owner | Reactivate account | `src/pages/PlatformAdmin.tsx` (`handleReactivate`) | `action.owner.account.reactivate` | Not covered |
| Platform Owner | Trial action | `src/pages/PlatformAdmin.tsx` (`handleTrialAction`) | `action.owner.trial.update` | Not covered |
| Platform Owner | Delete account hard | `src/pages/PlatformAdmin.tsx` (`handleDeleteHard`) | `action.owner.account.delete` | Not covered |
| BusFlow Routes | Save route | `src/apps/busflow/BusflowApp.tsx` (`handleSaveRoute`) | `action.busflow.route.save` | Not covered |
| BusFlow Routes | Delete route | `src/apps/busflow/BusflowApp.tsx` (`handleConfirmDeleteRoute`) | `action.busflow.route.delete` | Not covered |
| BusFlow Settings | Create/delete bus type | `src/apps/busflow/BusflowApp.tsx` | `action.busflow.busType.save` / `action.busflow.busType.delete` | Not covered |
| BusFlow Settings | Create/delete worker | `src/apps/busflow/BusflowApp.tsx` | `action.busflow.worker.save` / `action.busflow.worker.delete` | Not covered |
| BusFlow Contacts | Create/update/delete contact | `src/apps/busflow/BusflowApp.tsx` | `action.busflow.contact.save` / `action.busflow.contact.delete` | Not covered |
| BusFlow Import | Commit customer import | `src/apps/busflow/BusflowApp.tsx` + `CustomerManagementPanel.tsx` | `action.busflow.customer.import` | Not covered |
| BusFlow Bulk Delete | Bulk remove contacts | `src/apps/busflow/BusflowApp.tsx` + `CustomerManagementPanel.tsx` | `action.busflow.customer.bulkDelete` | Not covered |
| BusFlow Settings | Save map default view | `src/apps/busflow/BusflowApp.tsx` (`handleSaveMapDefaultView`) | `action.busflow.map.save` | Not covered |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message-key enforcement | Per-handler manual checks | One shared action helper | Keeps consistency and enables inventory traceability. |
| Concurrent visibility correctness | Boolean global loading state | Existing token/ref-count `LoadingEngine` | Already tested for overlap and cleanup. |
| Progress synchronization | Separate unrelated progress and loading lifecycles | Single action token plus `update(token, progress)` | Preserves one source of truth for long-running action visibility. |
| Inventory governance | End-of-phase spreadsheet cleanup | In-repo markdown inventory updated per flow migration | Prevents missed flows and supports QUAL-03 proof. |

**Key insight:** Most Phase 3 risk is rollout inconsistency, not missing infrastructure. Guardrails (strict helper + inventory discipline) are the quality lever.

## Common Pitfalls

### Pitfall 1: Unknown action keys silently falling back to `Lade...`
**What goes wrong:** Coverage appears complete but user sees generic text; inventory confidence drops.  
**Why it happens:** Current resolver intentionally falls back silently.  
**How to avoid:** Development warning path in action helper for unresolved `action.*` keys.  
**Warning signs:** New action wiring lands without matching `loading-messages.ts` entry.

### Pitfall 2: Losing fine-grained local affordances
**What goes wrong:** Buttons/dialog states regress because local `isSubmitting` flags are removed too aggressively.  
**Why it happens:** Assuming global full-page loading can replace all local UI states.  
**How to avoid:** Keep existing local flags for component affordances; layer global loading on top for platform consistency.  
**Warning signs:** Confirm dialogs no longer show busy labels or controls re-enable too early.

### Pitfall 3: Progress viewport hidden behind full-page overlay
**What goes wrong:** Long-running jobs show no detailed progress while global loader is active.  
**Why it happens:** Current z-index ordering puts `ProgressViewport` below `FullPageLoadingScreen`.  
**How to avoid:** Define explicit coexistence behavior in rollout (z-index or composition strategy) for import/delete jobs.  
**Warning signs:** Import/bulk-delete progress text disappears when action loading starts.

### Pitfall 4: Partial handler wrapping creates misleading loader lifecycle
**What goes wrong:** Global loader stops too early or message flickers between action and refresh steps.  
**Why it happens:** Wrapping only part of a multi-step mutation flow.  
**How to avoid:** Treat each user-triggered flow as one wrapper boundary where possible; document exceptions in inventory notes.  
**Warning signs:** Loader briefly disappears during same user action then reappears.

## Code Examples

Existing verified lifecycle contract:

```typescript
// src/shared/loading/loading-engine.ts
async runWithLoading<T>(operation: () => Promise<T> | T, options: LoadingStartOptions = {}): Promise<T> {
  const token = this.start(options);
  try {
    return await operation();
  } finally {
    this.stop(token);
  }
}
```

Existing overlap semantics (keep for FLOW-04):

```typescript
// src/shared/loading/loading-engine.ts
const currentOperation = Array.from(this.operations.values()).sort((a, b) => b.startedAtMs - a.startedAtMs)[0];
```

Recommended handler migration shape:

```typescript
const runAction = useActionLoading();

await runAction(async () => {
  await PlatformAdminApi.updateAccount(editAccount.id, { status: 'ARCHIVED' });
  await loadOwnerOverview();
}, 'action.owner.account.archive');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Route/auth-only loading orchestration | Route/auth orchestration complete; action flows mostly local-only | Phase 2 complete on 2026-02-28 | Infrastructure is ready, rollout gap remains. |
| Generic action key set (`save/delete/import`) | Need domain-specific action keys for invite/security/owner/busflow mutations | Required in Phase 3 context | Better clarity and inventory-level traceability. |

**Deprecated/outdated for this phase:**
- Treating local button spinner state as sufficient loading feedback for critical mutations.
- Rolling out coverage without an explicit flow inventory artifact.

## Open Questions

1. **Progress coexistence implementation detail**
   - What we know: locked decision requires ProgressViewport + global loading together.
   - What's unclear: whether to solve by z-index change, portal composition, or loader-integrated progress summary.
   - Recommendation: pick one explicit strategy in Plan 03-01 and verify it in import + bulk-delete flows first.

2. **Action key namespace granularity**
   - What we know: keys must be explicit and include invite/security actions.
   - What's unclear: final granularity (per domain-action vs more generic groups).
   - Recommendation: start with domain-action keys in baseline inventory table and refactor only if redundancy becomes measurable.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-platform-action-coverage-rollout/03-CONTEXT.md` - locked decisions, discretion, integration points.
- `.planning/REQUIREMENTS.md` - FLOW-03, FLOW-04, QUAL-03 definitions.
- `.planning/STATE.md` - current milestone position and completed prerequisite phases.
- `.planning/ROADMAP.md` - Phase 3 goal, plans, and success criteria.
- `src/shared/loading/loading-engine.ts` - token lifecycle, overlap semantics, message/progress display model.
- `src/shared/loading/LoadingProvider.tsx` - `runWithLoading` interface and provider contract.
- `src/shared/loading/loading-messages.ts` - current action key coverage and fallback behavior.
- `src/app/providers/AppProviders.tsx` - provider composition and viewport placement.
- `src/shared/components/ProgressViewport.tsx` - progress viewport behavior and z-index.
- `src/app/router/AppRouter.tsx` - profile-security mutation handlers.
- `src/pages/TeamAdmin.tsx` - invite/delete/role/invitation mutation handlers.
- `src/pages/PlatformAdmin.tsx` - owner mutation handlers.
- `src/apps/busflow/BusflowApp.tsx` - route/settings/import mutation handlers.
- `src/apps/busflow/components/settings/CustomerManagementPanel.tsx` - long-running import/delete progress orchestration.
- `src/shared/loading/LoadingProvider.test.tsx` - cleanup and overlap tests proving FLOW-04 primitives.
- `src/shared/loading/loading-messages.test.ts` - resolver behavior and fallback coverage.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - fully derived from repository dependencies and existing runtime modules.
- Architecture: HIGH - based on implemented loading/progress/provider patterns already in production paths.
- Pitfalls: HIGH - directly observable from current handler patterns and viewport layering.

**Research date:** 2026-02-28  
**Valid until:** 2026-03-28
