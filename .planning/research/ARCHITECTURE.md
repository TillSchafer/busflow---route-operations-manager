# Architecture Research

**Domain:** Brownfield BusPilot MVP 1.1 integration architecture (React SPA + Supabase)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                    Experience + Route Surface Layer                  │
├───────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────┐ │
│  │ AppRouter/Auth Flow │  │ BusflowApp + Pages  │  │ Admin/Profile │ │
│  └──────────┬──────────┘  └──────────┬──────────┘  └──────┬────────┘ │
│             │                        │                    │          │
├─────────────┴────────────────────────┴────────────────────┴──────────┤
│                 Domain Application Layer (Brownfield)                │
├───────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────┐ │
│  │ Capability Resolver │  │ BusFlow API Facade   │  │ Shared        │ │
│  │ (role visibility)   │  │ (routes/settings/...)│  │ Validation    │ │
│  └──────────┬──────────┘  └──────────┬───────────┘  └──────┬───────┘ │
│             │                        │                     │         │
├─────────────┴────────────────────────┴─────────────────────┴─────────┤
│                        Persistence + Security Layer                   │
├───────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────┐ │
│  │ PostgREST + RLS     │  │ RPC (route writes,  │  │ Edge Functions│ │
│  │ account-scoped reads│  │ archive/delete ops) │  │ admin/security│ │
│  └──────────┬──────────┘  └──────────┬──────────┘  └──────┬────────┘ │
│             │                        │                    │          │
├─────────────┴────────────────────────┴────────────────────┴──────────┤
│                              PostgreSQL                               │
│   busflow_* tables, account_memberships, profiles, platform_accounts │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `AuthContext` + account summary | Preserve existing auth/registration model and derive effective account role | Keep current session hydration pattern; add explicit capability derivation |
| Capability resolver (new shared contract) | Centralize UI visibility and action permissions for ADMIN/DISPATCH/VIEWER | Shared helper consumed by router, header menu, busflow/admin actions |
| BusFlow API facade (modified) | Account-scoped route/settings/customer data access and mutation orchestration | Keep `src/apps/busflow/api/*.api.ts`; move critical lifecycle writes to RPC |
| Shared validation module (new) | Single source for route/settings/profile input validation | `src/shared/validation` + `src/apps/busflow/validation` with typed error codes |
| Route lifecycle service (new RPC + API wrapper) | Consistent archive/delete behavior and restore policy | SQL RPCs + typed API wrappers returning domain codes |
| DB migration set (modified) | Launch-ready integrity, indexes, constraints, lifecycle columns | New SQL under `supabase/migrations/` only |

## Recommended Project Structure

```
src/
├── shared/
│   ├── auth/
│   │   └── capabilities.ts            # NEW: role->capability map for UI and actions
│   ├── validation/
│   │   ├── result.ts                  # NEW: normalized validation result shape
│   │   └── commonRules.ts             # NEW: shared field and format rules
│   └── loading/                       # EXISTING: reused for async feedback consistency
├── apps/busflow/
│   ├── api/
│   │   ├── routes.api.ts              # MODIFIED: lifecycle RPC wrappers + thin reads
│   │   ├── settings.api.ts            # MODIFIED: validation + optimistic update boundaries
│   │   └── lifecycle.api.ts           # NEW: archive/delete/restore entry points
│   ├── validation/
│   │   ├── routeValidation.ts         # NEW: route create/update validation rules
│   │   └── settingsValidation.ts      # NEW: settings payload validation rules
│   ├── hooks/
│   │   └── useBusflowData.ts          # MODIFIED: staged loading + query shaping
│   └── components/
│       ├── RouteEditor.tsx            # MODIFIED: consume shared validation and errors
│       └── Settings.tsx               # MODIFIED: role-aware settings visibility
├── features/
│   ├── profile/pages/ProfilePage.tsx  # MODIFIED: settings/security flow alignment
│   └── admin/*                        # MODIFIED: role and delete/archive visibility alignment
└── app/router/
    └── AppRouter.tsx                  # MODIFIED: capability-driven route/action gating

supabase/
├── functions/                          # EXISTING: keep auth/admin edge boundaries
└── migrations/
    ├── 2026xxxx__busflow_lifecycle.sql     # NEW: archive/delete schema + RPC
    ├── 2026xxxx__busflow_validation.sql    # NEW: DB checks for route integrity
    └── 2026xxxx__busflow_perf_indexes.sql  # NEW: account/date/status/search indexes
```

### Structure Rationale

- **`shared/auth/capabilities.ts` (new):** Removes repeated ad-hoc role checks and keeps role visibility consistent across app areas.
- **`shared/validation` + `apps/busflow/validation` (new):** Prevents drift between `RouteEditor`, API payload checks, and DB constraints.
- **`apps/busflow/api/lifecycle.api.ts` (new):** Isolates delete/archive rules from generic CRUD calls and keeps route CRUD concept intact.
- **`supabase/migrations` (modified):** Canonical location for all milestone DB changes; `docs/migrations` remains archive-only.

## Architectural Patterns

### Pattern 1: Capability-Driven UI + Action Gate

**What:** Resolve permissions once from `profiles.global_role + account_memberships.role`, then enforce in UI and mutation handlers.
**When to use:** Any route visibility, action button state, or mutation permission check.
**Trade-offs:** Adds one indirection layer, but eliminates scattered role logic and accidental visibility leaks.

**Example:**
```typescript
const caps = resolveCapabilities({ globalRole, accountRole });
if (!caps.canManageRoutes) return deny('FORBIDDEN');
```

### Pattern 2: Dual-Layer Validation Contract

**What:** Client validation for UX + server validation (RPC/check constraints) for integrity.
**When to use:** Route create/update, settings mutation, delete/archive transitions.
**Trade-offs:** Some duplication, but prevents invalid data from entering DB when client checks are bypassed.

**Example:**
```typescript
const result = validateRouteDraft(route);
if (!result.ok) return showErrors(result.errors);
await BusFlowApi.saveRouteWithStops(route, route.updatedAt);
```

### Pattern 3: Lifecycle-Explicit Delete/Archive

**What:** Separate route lifecycle transitions (`archive`, `restore`, `hard_delete`) from generic `delete()` calls.
**When to use:** Any destructive operation where auditability and role policy matter.
**Trade-offs:** More explicit APIs/RPCs, but safer behavior and clearer product semantics.

### Pattern 4: Staged Fetch + Query Shaping

**What:** Keep list views fast by reducing over-fetch and loading heavy details on demand.
**When to use:** Busflow list/search/navigation and settings screens.
**Trade-offs:** Slightly more client orchestration; significant perceived performance gain.

## Data Flow

### Request Flow

```
[User Action]
    ↓
[Component] → [Capability Check] → [Client Validation] → [API Facade]
    ↓                ↓                    ↓                 ↓
[UI Feedback] ← [Role Error]       [Field Errors]   [RPC/PostgREST]
    ↓                                                     ↓
[State Refresh/Reconcile] ← [Realtime + targeted refresh] ← [DB + RLS]
```

### State Management

```
[AuthContext + activeAccount]
    ↓
[Capability Resolver]
    ↓
[Feature Components] ←→ [BusFlow hooks] → [API Facade] → [Supabase]
```

### Key Data Flows

1. **Route save flow:** `RouteEditor` validates -> `save_busflow_route_with_stops` (account + conflict checks) -> reconcile list/editor state.
2. **Route lifecycle flow:** Route action -> lifecycle API (`archive/delete/restore`) -> DB lifecycle fields + optional hard delete policy.
3. **Settings flow:** Settings panel mutation -> shared validation -> scoped write -> targeted settings refresh.
4. **Role visibility flow:** Auth/account hydration -> capabilities -> router/menu/action visibility + server-side enforcement.
5. **Profile/security flow:** Existing auth/account-security flows preserved; only validation/messages and capability-based surface are tightened.

## New vs Modified Components

| Area | Component | Type | Why |
|------|-----------|------|-----|
| Auth/Role | `src/shared/auth/capabilities.ts` | NEW | Single permission contract for visibility and actions |
| Router | `src/app/router/AppRouter.tsx` | MODIFIED | Route + action gating via capabilities |
| BusFlow UI | `src/apps/busflow/components/RouteEditor.tsx` | MODIFIED | Shared validation errors and lifecycle actions |
| BusFlow Data | `src/apps/busflow/hooks/useBusflowData.ts` | MODIFIED | Staged fetch and refresh strategy for performance |
| BusFlow API | `src/apps/busflow/api/lifecycle.api.ts` | NEW | Explicit archive/delete/restore operations |
| BusFlow API | `src/apps/busflow/api/routes.api.ts` | MODIFIED | Keep CRUD path, add lifecycle RPC wrappers and slimmer list reads |
| Validation | `src/shared/validation/*`, `src/apps/busflow/validation/*` | NEW | Reusable validation rules and typed result contract |
| Settings | `src/apps/busflow/components/Settings.tsx` + panels | MODIFIED | Capability-aware settings visibility and consistent mutation handling |
| Admin/Profile | `src/features/admin/*`, `src/features/profile/*` | MODIFIED | Role visibility consistency and delete/archive UX alignment |
| DB | `supabase/migrations/*.sql` (new milestone files) | MODIFIED/NEW | Launch-ready constraints, indexes, lifecycle fields, RPCs |

## Phased Build Order (Milestone v1.1)

1. **Phase A: Role visibility contract first**
   - Deliver capability resolver and wire router/header/action gates.
   - Reason: prevents regressions when later features add new actions.

2. **Phase B: Validation backbone**
   - Add shared validation modules and integrate RouteEditor/settings/profile mutations.
   - Reason: stabilizes UX and error contracts before DB hardening.

3. **Phase C: Delete/archive lifecycle architecture**
   - Introduce lifecycle API + RPC/schema fields (`archived_at`, `archived_by`, optional `deleted_at/deleted_by` strategy).
   - Reason: high-risk behavior needs explicit contract before optimization.

4. **Phase D: Performance pass (read-path first)**
   - Query shaping, staged loading, focused refresh, index-aligned access paths.
   - Reason: improves user-perceived speed without changing product semantics.

5. **Phase E: Settings and admin/profile integration finish**
   - Align settings panels and admin/profile flows with capability + validation + lifecycle contracts.
   - Reason: unifies behavior across all user surfaces.

6. **Phase F: DB launch-readiness hardening**
   - Apply final migrations, enforce constraints/indexes, verify RLS and conflict/delete/archive behavior via tests/smoke checks.
   - Reason: milestone exits only when integrity and permissions are provable end-to-end.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Keep single SPA + Supabase pattern; prioritize index hygiene and query shaping |
| 1k-100k users | Add pagination defaults, denormalized read views for heavy route lists, telemetry for slow queries |
| 100k+ users | Consider separate read-model endpoints/materialized views and background lifecycle processing |

### Scaling Priorities

1. **First bottleneck:** route list over-fetch + realtime refresh fan-out.
2. **Second bottleneck:** mutation contention (concurrent edits/deletes) and unindexed filter paths.

## Anti-Patterns

### Anti-Pattern 1: Scattered Role Checks

**What people do:** Inline `user.role === 'ADMIN'` checks in many components.
**Why it's wrong:** Visibility behavior drifts and is hard to audit.
**Do this instead:** One capability resolver used everywhere.

### Anti-Pattern 2: Client-Only Validation

**What people do:** Validate in UI only and trust payloads at DB boundary.
**Why it's wrong:** Invalid writes still occur via API bypass or stale clients.
**Do this instead:** Client validation + RPC/check constraints with stable error codes.

### Anti-Pattern 3: Hard Delete as Default UX

**What people do:** Immediate irreversible delete from list actions.
**Why it's wrong:** No recovery path and weak auditability.
**Do this instead:** Archive as default user action; hard delete only explicit/authorized path.

### Anti-Pattern 4: Big-Bang DB Rewrite

**What people do:** Rebuild schema in one migration wave.
**Why it's wrong:** High outage and regression risk on brownfield systems.
**Do this instead:** Incremental additive migrations with compatibility window.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | Keep existing registration/login/callback flows | Preserve current auth concept unchanged |
| Supabase PostgREST | Account-scoped reads for low-risk data | Maintain strict `.eq('account_id', ...)` filtering |
| Supabase RPC | Canonical route save + lifecycle writes | Use for conflict checks and delete/archive invariants |
| Supabase Edge Functions | Admin/profile security and privileged operations | Keep existing function boundaries intact |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `AuthContext` ↔ Router/UI | Context + capability resolver | Single source of visibility truth |
| BusFlow components ↔ BusFlow API | Typed facade calls | No direct table writes from UI handlers |
| Validation modules ↔ UI/API | Shared result contract | Same error vocabulary across layers |
| Frontend ↔ DB | PostgREST for reads, RPC for critical writes | Preserves CRUD concept while hardening behavior |

## Sources

- `.planning/PROJECT.md` (v1.1 milestone goals and constraints)
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `src/app/router/AppRouter.tsx`
- `src/shared/auth/AuthContext.tsx`
- `src/apps/busflow/BusflowApp.tsx`
- `src/apps/busflow/api/routes.api.ts`
- `src/apps/busflow/api/settings.api.ts`
- `src/apps/busflow/hooks/useBusflowData.ts`
- `src/apps/busflow/hooks/useRealtimeSync.ts`
- `src/apps/busflow/components/RouteEditor.tsx`
- `supabase/migrations/README.md`
- `supabase/migrations/*.sql` and `docs/migrations/*` (reference lineage)

---
*Architecture research for: BusPilot MVP 1.1 brownfield integration*
*Researched: 2026-03-01*
