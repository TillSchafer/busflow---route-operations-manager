# Phase 9: Role Visibility and Enforcement Finalization - Research

**Researched:** 2026-03-01  
**Domain:** Role visibility, route/action gating, frontend-backend authorization consistency  
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Routen-Sichtbarkeit
- Standardfluss bleibt Busflow-first statt Admin-first.
- Innerhalb eines Accounts sehen ADMIN/DISPATCH/VIEWER dieselben Routen-Daten (kein Rollenfilter auf Routen-Sichtbarkeit fuer v1.1).
- Wenn ein Nicht-Platform-Admin keinen aktiven Account hat, bleibt der bestehende Aktivierungs-Screen verbindlich.
- Nicht erlaubte direkte Route-Navigation wird auf eine erlaubte Fallback-Route umgeleitet.

### Aktionen und Controls
- Team-Admin-Bereich (`/adminbereich`) ist nur fuer Account-Admins und Platform-Admins zugaenglich.
- Rollenwechsel von Mitgliedern ist nur fuer Account-Admins und Platform-Admins erlaubt.
- User-Hard-Delete wird fuer v1.1 auf Platform-Admins begrenzt.
- Einladungen senden/loeschen/erneut senden bleibt auf Account-Admins und Platform-Admins begrenzt.
- Nicht erlaubte Aktionen werden im UI standardmaessig versteckt statt deaktiviert angezeigt.

### Fehlerverhalten und Rueckmeldung
- Bei verweigerter Route-Navigation: Redirect plus kurzer Hinweis an den Nutzer.
- Bei serverseitig geblockten Aktionen: kurze generische Berechtigungs-Meldung (keine internen Details).
- Auth-Fehler (Session abgelaufen) werden strikt getrennt von Berechtigungsfehlern behandelt.

### Claude's Discretion
- Exakte Fallback-Prioritaet fuer Redirect-Ziele pro Rolle (konkretisierte Reihenfolge im Plan).
- Einheitliches Message-Mapping je Fehlercode in ein kurzes, konsistentes Textset.
- Konkrete Stellenliste, welche Controls versteckt statt disabled gerendert werden.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROLE-01 | Nutzer sehen nur Seiten, Daten und Aktionen, die ihrer Rolle entsprechen. | Central role-to-route/action matrix, shared capability resolver, route/nav/team-admin/busflow gating alignment |
| ROLE-02 | Unerlaubte Aktionen werden serverseitig geblockt, auch bei manipuliertem Client. | Edge-function enforcement hardening (especially hard-delete), existing auth wrappers, role matrix integration tests |
| ROLE-03 | Rollen-zu-Aktion-Matrix fuer Kernflows ist dokumentiert und verifiziert. | Add canonical matrix doc + tests/checklist + staging auth-matrix script coverage |
</phase_requirements>

## Summary

Current implementation already has strong building blocks: role derivation in `AuthContext`, route guards in `AppRouter`, and privileged admin mutations in edge functions. The main planning challenge is **drift elimination**: route/menu visibility, UI action visibility, and backend authorization must come from one canonical matrix contract.

Biggest concrete mismatch vs locked decisions: hard-delete is currently allowed for account admins in `admin-delete-user-v3`, but phase scope requires platform-admin-only hard-delete. Also, several unauthorized paths/actions currently use silent redirects or disabled controls instead of hidden controls + short permission hints.

**Primary recommendation:** implement a single typed role matrix contract (route + action + fallback + message mapping), consume it in router/header/team-admin/busflow UI, and enforce the same contract in edge functions plus auth-matrix tests.

## Current-State Findings

### What is already in place

- Role derivation and tenant-admin helper:
  - `src/shared/auth/AuthContext.tsx` derives effective role and `canManageTenantUsers`.
- Route-level guarding:
  - `src/app/router/AppRouter.tsx` gates `/adminbereich` by `canManageTenantUsers` and `/owner-bereich` by owner flag.
- Team-admin privileged mutations mostly routed through edge functions:
  - `src/shared/api/admin/teamAdmin.api.ts` invokes `admin-update-membership-role-v1`, `admin-manage-invitation-v1`, `admin-delete-user-v3`, `invite-account-user`.
- Auth-vs-session separation base exists:
  - `src/shared/lib/supabaseFunctions.ts` throws `FunctionAuthError` for session problems.

### Gaps to plan around (high impact)

1. Hard-delete policy mismatch:
   - `supabase/functions/admin-delete-user-v3/index.ts` currently allows account admins (not only platform admins).
2. Unauthorized UI controls are often disabled, not hidden:
   - TeamAdmin and Busflow use disabled controls for permission-like states.
3. Forbidden-route UX requirement not fully implemented:
   - Router redirects but does not consistently show "kurzer Hinweis" for denied direct navigation.
4. Permission message consistency is partial:
   - Some catches map `FORBIDDEN`, others surface raw function messages/codes.
5. Role matrix is not currently documented as one canonical artifact:
   - Risk of future drift across router/menu/component/function checks.

## Standard Stack

### Core

| Library/Area | Version/State | Purpose in this phase | Why standard here |
|---|---|---|---|
| React + TypeScript | React 19, TS 5.8 | Role visibility in components/routes | Existing app standard |
| React Router | v6 | Route guard + fallback redirects | Existing router foundation in `AppRouter` |
| Supabase Edge Functions | Deno + supabase-js | Server-side enforcement for privileged admin actions | Existing security-critical mutation path |
| Supabase PostgREST/RPC | existing | Account-scoped data reads/writes and business RPC | Existing data boundary |
| Vitest + Testing Library | Vitest 4 | Frontend behavior regression tests | Existing test framework |

### Supporting

| Module | Purpose |
|---|---|
| `src/shared/auth/AuthContext.tsx` | Role source (`user.role`, `activeAccount`, `canManageTenantUsers`) |
| `src/shared/lib/supabaseFunctions.ts` | Auth-aware function invocation + session invalid handling |
| `scripts/supabase/e2e-functions-auth-matrix.mjs` | Staging role/auth matrix checks for functions |

## Architecture Patterns

### Recommended Pattern: Canonical Capability Matrix (single source of truth)

Create one shared contract, then consume everywhere:

1. `src/shared/auth/roleAccess.ts` (new)
2. `Route access map` + `Action access map` + `Fallback map` + `Message map`
3. Helpers:
   - `canAccessRoute(principal, routeId)`
   - `canPerformAction(principal, actionId)`
   - `getDeniedFallback(routeId, principal)`
   - `mapPermissionError(code)`

### Role principal model (recommended)

Use a normalized principal shape for all checks:
- `isPlatformAdmin`
- `isPlatformOwner`
- `accountRole` (`ADMIN|DISPATCH|VIEWER|null`)
- `hasActiveAccount`

### Option comparison for matrix implementation

| Option | Description | Pros | Cons | Recommendation |
|---|---|---|---|---|
| A | Typed TS matrix in `shared/auth/roleAccess.ts` | Fast adoption, compile-time safety, easy tests | Requires migration from ad-hoc checks | **Recommended** |
| B | Keep checks in-place, add docs only | Lowest immediate changes | Drift remains likely | Not recommended |
| C | Route metadata + generic guard HOC/hook | Very clean long-term router pattern | Higher refactor cost now | Good follow-up after A |

### Concrete v1.1 matrix baseline (for planning)

#### Route matrix

| Route/Surface | Platform Admin | Account Admin | Dispatch | Viewer | No active account (non-platform-admin) |
|---|---|---|---|---|---|
| `/` home | allow | allow | allow | allow | pending-activation screen |
| `/busflow` | allow (with account context) | allow | allow | allow | redirect to activation screen |
| `/profile` | allow | allow | allow | allow | allow |
| `/adminbereich` | allow | allow | deny | deny | deny |
| `/owner-bereich` | owner only | deny | deny | deny | deny |

#### Action matrix (core flows)

| Action | Platform Admin | Account Admin | Dispatch | Viewer |
|---|---|---|---|---|
| Change membership role | allow | allow | deny | deny |
| Invite send/resend/delete | allow | allow | deny | deny |
| User hard delete | allow | deny | deny | deny |
| Busflow route/settings write | allow | allow | allow | deny |
| Busflow read | allow | allow | allow | allow |

#### Redirect fallback order (discretion -> recommendation)

1. If route denied and user can access `/adminbereich`: redirect `/adminbereich`
2. Else redirect `/`
3. If non-platform-admin and no account, enforce pending-account screen (existing behavior)
4. Attach one short denied toast/message key on redirect

## Implementation Risks and Guardrails

| Risk | Why it matters | Guardrail |
|---|---|---|
| Matrix drift between frontend and backend | ROLE-01/02 regress silently | One canonical matrix file + edge-function assertions + test map tied to matrix rows |
| Hard-delete remains too broad | Violates locked decision and ROLE-02 | Restrict `admin-delete-user-v3` to platform admins only; add negative tests for account admin |
| Disabled vs hidden mismatch | UX/visibility requirement miss | Explicit hide policy list for unauthorized actions; reserve disabled for non-role states (loading/account status) |
| Permission messages leak internals | Security/UX inconsistency | Central message mapping for `FORBIDDEN`, `USER_SCOPE_VIOLATION`, etc.; do not pass raw function text |
| Route redirect without hint | Locked decision miss | Central denied-route handler that performs redirect + short toast |
| Unknown backend policy state in local migrations | Planning blind spot for ROLE-02 | Use staging auth-matrix script as verification gate; avoid assuming local SQL mirror is complete |

## Don'"'"'t Hand-Roll

| Problem | Don'"'"'t build | Use instead |
|---|---|---|
| Scattered role if-statements in each component | ad-hoc role checks | Shared typed capability matrix helper |
| Custom function call auth handling per API | repeated invoke+auth parsing | `invokeAuthedFunction` + centralized error mapping |
| One-off role test scripts | bespoke temporary checks | Extend `scripts/supabase/e2e-functions-auth-matrix.mjs` |

## Common Pitfalls

### Pitfall 1: Mixing principal concepts

- What goes wrong: checks compare `user.role` in one place and `activeAccount.role` in another.
- Avoid: always resolve from normalized principal object.

### Pitfall 2: Treating account status locks as role denial

- What goes wrong: disabled controls for suspended/archived account get mistaken as role-hidden behavior.
- Avoid: separate `roleDenied` and `accountWritable` UI paths.

### Pitfall 3: Assuming frontend deny is enough

- What goes wrong: manipulated client still hits mutation.
- Avoid: keep edge function checks authoritative and test forbidden roles explicitly.

### Pitfall 4: Inconsistent permission message handling

- What goes wrong: raw codes/messages leak (`FORBIDDEN`, internal text).
- Avoid: shared permission-error message mapper used by TeamAdmin and router redirect hints.

## Test Strategy (ROLE-01/02/03)

### Coverage targets by requirement

| Requirement | What to verify | Test type | Proposed location/command |
|---|---|---|---|
| ROLE-01 | Route/nav/action visibility matches matrix per role | unit + component | new `src/shared/auth/roleAccess.test.ts`; new router/menu/admin tests via `npm run test` |
| ROLE-02 | Forbidden mutations fail server-side for disallowed roles | staging integration | extend `scripts/supabase/e2e-functions-auth-matrix.mjs` and run with staging credentials |
| ROLE-03 | Matrix is documented and verifiably mapped to tests | docs + traceability checks | matrix doc in repo + requirement-to-test table in phase deliverables |

### Concrete frontend tests to add

1. `AppRouter` route-deny behavior:
   - dispatch/viewer direct to `/adminbereich` => redirect + short hint.
   - non-owner to `/owner-bereich` => fallback order respected.
2. `ProfileMenu` visibility:
   - admin menu item hidden for dispatch/viewer.
3. `TeamAdminPage` control visibility:
   - hard-delete button hidden unless platform admin.
   - invite/role controls hidden for unauthorized roles (when rendered under mocked states).
4. `error-mapping` permission messaging:
   - `FORBIDDEN` and related codes map to generic permission text.

### Concrete backend/staging checks to add

1. Extend auth matrix script with `admin-delete-user-v3` cases:
   - platform admin => expected allow.
   - account admin/dispatch/viewer => expected forbidden.
2. Keep existing checks for:
   - `admin-update-membership-role-v1` allow for account admin, deny for viewer.
3. Add cases for `admin-manage-invitation-v1` and `invite-account-user` deny paths.

### Verification checklist (phase gate)

- [ ] Canonical route/action matrix file exists and is referenced by router + team admin + menu checks.
- [ ] `/adminbereich` and `/owner-bereich` denied navigation triggers redirect + short user hint.
- [ ] Unauthorized actions are hidden (not merely disabled) where decision requires it.
- [ ] `admin-delete-user-v3` enforces platform-admin-only hard-delete.
- [ ] Permission errors show generic user text; session errors remain distinct.
- [ ] ROLE-01/02/03 mapping table is documented and test evidence is attached.

## Suggested Plan Decomposition Inputs (logical chunks)

1. Matrix contract and types
   - Add canonical `roleAccess` module and initial route/action/fallback/message matrix.
2. Frontend route + navigation alignment
   - Wire `AppRouter` and menu visibility to matrix helper.
   - Implement denied-route short hint behavior.
3. TeamAdmin visibility and message normalization
   - Convert unauthorized controls to hidden where required.
   - Centralize permission error mapping in UI.
4. Backend enforcement finalization
   - Update `admin-delete-user-v3` to platform-admin-only hard-delete.
   - Confirm invite/role-change function checks remain aligned.
5. Verification artifacts (ROLE-03 closure)
   - Add/extend tests + staging auth matrix script cases.
   - Publish role-to-route/action matrix doc and requirement traceability.

## Open Questions for Planning

1. Should platform admins without active account see `/busflow`, or always route to `/`?
   - Current code requires `activeAccountId` for `/busflow`.
2. Where should the canonical matrix live for team discoverability?
   - Recommendation: `src/shared/auth/roleAccess.ts` + `docs/architecture/role-action-matrix.md`.
3. Which controls are explicitly in the "hide not disable" list?
   - Need exact list as a planning artifact before implementation tasks.

## Sources

### Primary

- `.planning/phases/09-role-visibility-and-enforcement-finalization/09-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `CLAUDE.md`
- `src/shared/auth/AuthContext.tsx`
- `src/app/router/AppRouter.tsx`
- `src/features/admin/team/pages/TeamAdminPage.tsx`
- `src/shared/components/ProfileMenu.tsx`
- `src/shared/api/admin/teamAdmin.api.ts`
- `src/shared/lib/supabaseFunctions.ts`
- `src/apps/busflow/BusflowApp.tsx`
- `src/apps/busflow/api/routes.api.ts`
- `supabase/functions/admin-update-membership-role-v1/index.ts`
- `supabase/functions/admin-delete-user-v3/index.ts`
- `supabase/functions/admin-manage-invitation-v1/index.ts`
- `supabase/functions/invite-account-user/index.ts`
- `scripts/supabase/e2e-functions-auth-matrix.mjs`

### Supporting

- `docs/architecture/role-model.md`
- `docs/architecture/db-current-state.md`
- `.planning/codebase/TESTING.md`
- `.planning/research/ARCHITECTURE.md`

## Metadata

**Confidence breakdown:**
- Current-state code assessment: HIGH (direct file inspection)
- Matrix architecture recommendation: HIGH (fits existing architecture and constraints)
- Backend policy completeness confidence: MEDIUM (local `supabase/migrations/` is not a full historical schema mirror)

**Valid until:** 2026-03-31 (or until major auth/edge-function refactor)

