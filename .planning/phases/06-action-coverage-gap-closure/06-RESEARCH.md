# Phase 6: Action Coverage Gap Closure - Research

**Researched:** 2026-02-28
**Domain:** React action-path loading rollout on top of existing shared loading engine
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Wrapper-Policy
- Für Phase 6 ist ein zentraler, verpflichtender Action-Loading-Wrapper festzulegen und als Standard zu nutzen.
- Der Wrapper gilt für alle kritischen Mutationsflows (Profile, TeamAdmin, PlatformAdmin, BusFlow), nicht nur für Teilmengen.
- Rollout erfolgt horizontal über alle betroffenen Domains in Phase 6 (kein reines Risk-first oder Layer-first Splitting).
- Bei unbekanntem/fehlendem Message-Key: User-Fallback bleibt aktiv (`Lade...`), zusätzlich verpflichtende Dev-Warnung.

### Message-Policy
- Action-Messages werden domain-spezifisch ausgebaut (nicht bei nur generischen `action.save/delete/import` bleiben).
- Sprachstil bleibt kurze deutsche Verb-Form.
- Invite- und Security-Flows erhalten explizite, auf die Aktion bezogene Loading-Messages.
- Beim Wiring einer neuen Action ist das Nachziehen der Message-Registry im selben Change verpflichtend.

### Concurrency- und Progress-Verhalten
- Bei parallelen Actions bleibt die aktuellste Action-Meldung führend.
- Full-Page-Loader bleibt für Action-Flows standardmäßig blockierend.
- Für lange Jobs (insb. Import/Delete) müssen Full-Page-Loader und ProgressViewport gleichzeitig sichtbar bleiben.
- Wenn eine parallele Action fehlschlägt, bleibt globales Loading aktiv, bis alle laufenden Actions beendet sind; Fehlerkommunikation erfolgt separat.

### Inventory-Governance
- Pflicht-Artefakt: `.planning/phases/06-action-coverage-gap-closure/06-ASYNC-FLOW-INVENTORY.md`.
- Ein Inventory-Eintrag entspricht einem user-triggered Action-Flow (nicht nur Modul/Endpoint).
- Statusmodell: `Not covered` / `Covered` / `Verified`.
- Inventory-Update inkl. Evidenz ist im selben Change wie das jeweilige Action-Wiring verpflichtend.

### Claude's Discretion
- Konkreter API-Name und Dateiort des Wrappers, solange der zentrale Pflichtcharakter erfüllt ist.
- Feingranulare Benennung der neuen Action-Keys innerhalb der festgelegten Message-Policy.
- Konkrete Spaltenstruktur des Inventory-Dokuments, solange Flow-Granularität und Statusmodell eingehalten werden.

### Deferred Ideas (OUT OF SCOPE)
None — Diskussion blieb im Phase-6-Scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-03 | Critical mutation actions (save, delete, invite, import, profile security actions) trigger the shared loading screen consistently. | Use one mandatory action wrapper over `useLoading()` and wire all listed mutation handlers in AppRouter, TeamAdmin, PlatformAdmin, and BusFlow. |
| FLOW-04 | Concurrent async actions are handled correctly so loading visibility remains accurate until all active operations are complete. | Keep token-based lifecycle from `LoadingEngine`; no boolean global loader shortcuts; ensure wrapper always cleans up in `finally`. |
| QUAL-03 | A documented async flow inventory confirms no loading-prone user flow is left uncovered. | Maintain `06-ASYNC-FLOW-INVENTORY.md` as flow-level source of truth and update it in the same changes as wiring. |
</phase_requirements>

## Summary

Phase 6 is a rollout/governance phase, not an infrastructure rebuild. Core primitives already exist and are stable: `LoadingProvider` exposes `runWithLoading/start/update/stop`, `LoadingEngine` already handles overlap via tokens and newest-operation display precedence, and route/auth loading is already centralized.

The gap is action-path integration coverage. Critical mutation handlers across Profile/Admin/Owner/BusFlow still rely on local busy flags and toasts only, so FLOW-03/FLOW-04 remain orphaned at milestone level. Planning should focus on enforcing one strict wrapper contract, wiring every in-scope mutation handler, and maintaining flow-level inventory evidence while implementing.

**Primary recommendation:** Build one strict action wrapper in `src/shared/loading/`, expand `action.*` message keys before/with each wiring change, and execute the rollout in domain batches that each ship with inventory status/evidence updates.

## Standard Stack

### Core
| Library/Module | Version | Purpose | Why Standard |
|---|---|---|---|
| `react` | `^19.2.3` | Hook-based wrapper integration in mutation handlers | Existing app architecture and handler patterns are React hooks. |
| `src/shared/loading/LoadingProvider.tsx` | in-repo | Shared loading API (`runWithLoading/start/update/stop`) | Already used by route/auth and tested. |
| `src/shared/loading/loading-engine.ts` | in-repo | Concurrency, reveal delay, newest-operation display | Existing implementation already matches FLOW-04 behavior target. |
| `src/shared/loading/loading-messages.ts` | in-repo | Message key registry + fallback policy | Existing central source for scoped loading copy. |

### Supporting
| Library/Module | Version | Purpose | When to Use |
|---|---|---|---|
| `src/shared/components/ProgressProvider.tsx` + `ProgressViewport.tsx` | in-repo | Long-running progress channel | Import/bulk-delete actions with progress callbacks. |
| `src/shared/components/ToastProvider.tsx` | in-repo | Success/error communication | Preserve existing UX while global loader runs. |
| `vitest` + `@testing-library/react` | `^4.0.18` / `^16.3.2` | Regression checks | Wrapper contract + overlap/coexistence verification. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Shared strict wrapper | Per-handler direct `runWithLoading` | High drift risk (missing keys, inconsistent warnings, uneven cleanup). |
| Central key registry update policy | Inline ad-hoc messages | Breaks governance and weakens inventory traceability. |

**Installation:**
```bash
# No new dependencies needed.
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── shared/loading/
│   ├── useActionLoading.ts         # new strict wrapper hook/helper
│   ├── loading-messages.ts         # expanded action key registry
│   └── loading-messages.test.ts    # key/fallback regression coverage
├── app/router/AppRouter.tsx        # profile-security action wiring
├── pages/TeamAdmin.tsx             # invite/manage/delete action wiring
├── pages/PlatformAdmin.tsx         # owner action wiring
└── apps/busflow/BusflowApp.tsx     # save/delete/import/settings action wiring

.planning/phases/06-action-coverage-gap-closure/
└── 06-ASYNC-FLOW-INVENTORY.md      # required flow inventory evidence
```

### Pattern 1: Mandatory action wrapper (required key + dev warning)
**What:** One helper that always uses `scope: 'action'`, requires `messageKey`, warns in dev for unresolved keys, and delegates cleanup to shared lifecycle.
**When to use:** Every in-scope user-triggered mutation flow.
**Example:**
```typescript
import { useCallback } from 'react';
import { useLoading } from '@/shared/loading';
import { resolveScopedLoadingMessage } from '@/shared/loading/loading-messages';

export const useActionLoading = () => {
  const { runWithLoading } = useLoading();

  return useCallback(
    async <T>(operation: () => Promise<T> | T, messageKey: string): Promise<T> => {
      if (!messageKey.trim()) throw new Error('Action messageKey is required.');
      if (import.meta.env.DEV && !resolveScopedLoadingMessage('action', messageKey)) {
        console.warn(`[loading] Unknown action key: ${messageKey}`);
      }
      return runWithLoading(operation, { scope: 'action', messageKey });
    },
    [runWithLoading]
  );
};
```

### Pattern 2: Keep local busy UX, add global action loading around mutation boundary
**What:** Keep local `isSubmitting/isDeleting` flags for control-level UX and wrap async mutation + required refresh in one action wrapper boundary.
**When to use:** Existing handlers in TeamAdmin/PlatformAdmin/BusFlow/Profile.
**Example:**
```typescript
const runAction = useActionLoading();

setIsInviting(true);
try {
  await runAction(async () => {
    await TeamAdminApi.inviteTeamMember(payload);
    await loadData();
  }, 'action.team.invite.send');
  pushToast({ type: 'success', title: 'Einladung gesendet', message: 'Mitarbeiter wurde eingeladen.' });
} finally {
  setIsInviting(false);
}
```

### Pattern 3: Long-running import/delete use token updates for coexistence with progress
**What:** For flows with progress callbacks, use `start/update/stop` so full-page action loader and progress viewport stay active together.
**When to use:** Customer import and bulk-delete flows.
**Example:**
```typescript
const token = start({
  scope: 'action',
  messageKey: 'action.busflow.customer.import.commit',
  progress: { current: 0, total }
});
try {
  await commit(preview, resolutions, p => {
    update(token, { progress: { current: p.current, total: p.total } });
    updateProgress(progressId, { current: p.current, total: p.total });
  });
} finally {
  stop(token);
}
```

### Anti-Patterns to Avoid
- **Partial wrapping:** only wrapping API call but not required refresh/follow-up in same user action.
- **Silent unknown keys:** relying on `Lade...` fallback without dev warnings.
- **Replacing local busy flags entirely:** loses existing button/dialog busy affordances.
- **Ignoring overlay layering:** current `ProgressViewport` (`z-[1490]`) sits below `FullPageLoadingScreen` (`z-[1600]`) and can violate coexistence requirement.

## Plan-Critical Guidance (06-01 / 06-02 / 06-03)

### 06-01 Wrapper + Keys
- Define one wrapper API and enforce required `messageKey`.
- Expand `loading-messages.ts` with domain-specific action keys before handler wiring.
- Add/extend tests for unknown-key warning + fallback behavior.
- Decide coexistence strategy (z-index/layout contract) early because 06-02 and 06-03 depend on it.

### 06-02 Integration Rollout
- Roll out horizontally across domains in this order for low merge friction:
  1. `AppRouter` profile-security handlers
  2. `TeamAdmin` mutation handlers
  3. `PlatformAdmin` mutation handlers
  4. `BusflowApp` mutation handlers (+ long-running customer import/delete integration points)
- Keep existing toast/error semantics unchanged.
- Ensure each wired action gets corresponding message key + inventory row update in same change.

### 06-03 Inventory + Verification
- Create required artifact `06-ASYNC-FLOW-INVENTORY.md`.
- Track one row per user-triggered flow with `Not covered`/`Covered`/`Verified`.
- Add evidence column(s) (file path + test/manual scenario) so audit traceability is explicit.
- Verify overlap behavior with at least one concurrent action scenario and one long-running progress scenario.

## Async Flow Inventory Baseline

Initial baseline for `06-ASYNC-FLOW-INVENTORY.md`:

| Domain | User Flow | Code Location | Suggested Key | Initial Status |
|---|---|---|---|---|
| Profile | Avatar speichern | `src/app/router/AppRouter.tsx` `handleProfileAvatarSave` | `action.profile.avatar.save` | Not covered |
| Profile | E-Mail-Änderung anfordern | `src/app/router/AppRouter.tsx` `handleProfileEmailChangeRequest` | `action.profile.email.change` | Not covered |
| Profile | Passwort-Reset anfordern | `src/app/router/AppRouter.tsx` `handleProfilePasswordResetRequest` | `action.profile.password.reset` | Not covered |
| Team Admin | User einladen | `src/pages/TeamAdmin.tsx` `handleInviteEmployee` | `action.team.invite.send` | Not covered |
| Team Admin | Rolle ändern | `src/pages/TeamAdmin.tsx` `handleUpdateMembershipRole` | `action.team.membership.update` | Not covered |
| Team Admin | User löschen | `src/pages/TeamAdmin.tsx` `handleDeleteUserHard` | `action.team.user.delete` | Not covered |
| Team Admin | Einladung löschen | `src/pages/TeamAdmin.tsx` `handleDeleteInvitation` | `action.team.invitation.delete` | Not covered |
| Team Admin | Einladung erneut senden | `src/pages/TeamAdmin.tsx` `handleResendInvitation` | `action.team.invitation.resend` | Not covered |
| Owner Admin | Firma + Admin anlegen | `src/pages/PlatformAdmin.tsx` `handleCreateAccountAndInviteAdmin` | `action.owner.account.create` | Not covered |
| Owner Admin | Firmendaten speichern | `src/pages/PlatformAdmin.tsx` `handleSaveEdit` | `action.owner.account.save` | Not covered |
| Owner Admin | Firma archivieren | `src/pages/PlatformAdmin.tsx` `handleArchive` | `action.owner.account.archive` | Not covered |
| Owner Admin | Firma reaktivieren | `src/pages/PlatformAdmin.tsx` `handleReactivate` | `action.owner.account.reactivate` | Not covered |
| Owner Admin | Trial aktualisieren | `src/pages/PlatformAdmin.tsx` `handleTrialAction` | `action.owner.trial.update` | Not covered |
| Owner Admin | Firma final löschen | `src/pages/PlatformAdmin.tsx` `handleDeleteHard` | `action.owner.account.delete` | Not covered |
| BusFlow Routes | Route speichern | `src/apps/busflow/BusflowApp.tsx` `handleSaveRoute` | `action.busflow.route.save` | Not covered |
| BusFlow Routes | Route löschen | `src/apps/busflow/BusflowApp.tsx` `handleConfirmDeleteRoute` | `action.busflow.route.delete` | Not covered |
| BusFlow Settings | Bustyp anlegen/löschen | `src/apps/busflow/BusflowApp.tsx` | `action.busflow.bus_type.save` / `action.busflow.bus_type.delete` | Not covered |
| BusFlow Settings | Mitarbeiter anlegen/löschen | `src/apps/busflow/BusflowApp.tsx` | `action.busflow.worker.save` / `action.busflow.worker.delete` | Not covered |
| BusFlow Contacts | Kontakt anlegen/ändern/löschen | `src/apps/busflow/BusflowApp.tsx` | `action.busflow.contact.save` / `action.busflow.contact.delete` | Not covered |
| BusFlow Import | Kundenimport commit | `src/apps/busflow/BusflowApp.tsx` + `CustomerManagementPanel.tsx` | `action.busflow.customer.import.commit` | Not covered |
| BusFlow Delete | Bulk-Kontakte löschen | `src/apps/busflow/BusflowApp.tsx` + `CustomerManagementPanel.tsx` | `action.busflow.customer.bulk_delete` | Not covered |
| BusFlow Settings | Karten-Standard speichern | `src/apps/busflow/BusflowApp.tsx` `handleSaveMapDefaultView` | `action.busflow.map_default.save` | Not covered |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Global action lifecycle | Per-page boolean loading state | Existing token lifecycle in `LoadingEngine` | Correct overlap semantics already implemented. |
| Action wrapping contract | N ad-hoc helper variants | One shared wrapper in `src/shared/loading/` | Prevents drift and simplifies verification. |
| Message coverage tracking | Informal checklist | `loading-messages.ts` + inventory artifact | Enforces registry and audit evidence linkage. |
| Progress orchestration replacement | New progress system | Existing `ProgressProvider` + loader token update | Minimizes risk and preserves current UX channel. |

**Key insight:** Phase success depends more on governance discipline (wrapper + key + inventory in same change) than on new technical primitives.

## Common Pitfalls

### Pitfall 1: Unknown keys quietly degrade to generic text
**What goes wrong:** Flow appears wired but user sees only `Lade...`.
**How to avoid:** Dev warning on unresolved action key and key registry update required in same change.

### Pitfall 2: Incomplete mutation boundary wrapping
**What goes wrong:** Loader stops before refresh/toast path finishes, causing flicker/misleading visibility.
**How to avoid:** Wrap the full user-triggered action unit (mutation + required refresh).

### Pitfall 3: Coexistence regression on long-running jobs
**What goes wrong:** Full-page loader hides progress viewport details.
**How to avoid:** Explicitly implement and verify coexistence strategy (layering/composition) for import/delete.

### Pitfall 4: Coverage drift between code and inventory
**What goes wrong:** QUAL-03 becomes unverifiable despite code changes.
**How to avoid:** Treat inventory update as part of definition-of-done for each wired flow.

## Code Examples

Current cleanup contract (already in code):

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

Current newest-operation precedence (already in code):

```typescript
// src/shared/loading/loading-engine.ts
const currentOperation = Array.from(this.operations.values()).sort((a, b) => b.startedAtMs - a.startedAtMs)[0];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Route/auth loading only | Route/auth integrated + action flows mostly unwired | Phase 2 complete on 2026-02-28 | Infrastructure ready; rollout gap remains blocker. |
| Generic `action.save/delete/import` keys | Need domain-specific keys for audit-grade clarity | Required by Phase 6 decisions on 2026-02-28 | Better UX precision and better inventory traceability. |

**Deprecated/outdated for this phase:**
- Treating local button spinners as sufficient for FLOW-03.
- Shipping action wiring without inventory evidence update.

## Open Questions

1. **Coexistence implementation detail**
   - What we know: long-running import/delete must show Full-Page-Loader and ProgressViewport together.
   - What’s unclear: whether to solve by z-index adjustment or composition change.
   - Recommendation: decide in 06-01 and verify in 06-02 with import + bulk delete.

2. **Action key granularity convention**
   - What we know: keys must be domain-specific and explicit.
   - What’s unclear: strict naming convention depth (e.g., `action.owner.account.save` vs shorter forms).
   - Recommendation: lock naming pattern in 06-01 and apply consistently across all domains.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/06-action-coverage-gap-closure/06-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/v1.0-MILESTONE-AUDIT.md`
- `CLAUDE.md`
- `package.json`
- `src/shared/loading/loading-engine.ts`
- `src/shared/loading/LoadingProvider.tsx`
- `src/shared/loading/loading-messages.ts`
- `src/shared/loading/FullPageLoadingScreen.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/shared/components/ProgressProvider.tsx`
- `src/shared/components/ProgressViewport.tsx`
- `src/app/router/AppRouter.tsx`
- `src/pages/TeamAdmin.tsx`
- `src/pages/PlatformAdmin.tsx`
- `src/apps/busflow/BusflowApp.tsx`
- `src/apps/busflow/components/settings/CustomerManagementPanel.tsx`
- `src/shared/loading/LoadingProvider.test.tsx`
- `src/shared/loading/FullPageLoadingScreen.test.tsx`
- `src/app/router/AppRouter.loading.test.tsx`

### Secondary (MEDIUM confidence)
- `.planning/phases/03-platform-action-coverage-rollout/03-RESEARCH.md` (historical baseline; revalidated against current code)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived from current repository dependencies and modules.
- Architecture: HIGH - based on implemented loading/progress/provider behavior and real integration points.
- Pitfalls: HIGH - based on direct code inspection of current gaps and layering.

**Research date:** 2026-02-28
**Valid until:** 2026-03-28
