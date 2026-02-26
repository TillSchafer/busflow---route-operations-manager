# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Web SPA + Supabase Backend (client-driven data access with edge-function boundaries).

**Key Characteristics:**
- Client-side routed React app (no Next.js SSR layer).
- Hybrid frontend structure: `app/` + `features/` + `shared/` with legacy `pages/` still active.
- Multi-tenant/account-aware domain logic (explicit `account_id` scoping).
- Canonical high-risk operations routed through Supabase RPC / Edge Functions.

## Layers

**App Shell Layer (`src/app/*`):**
- Purpose: Bootstrap providers and route graph.
- Contains: `AppProviders`, `AppRouter`, `AuthCallbackNormalizer`.
- Depends on: Auth context, shared components, feature-page wrappers.
- Used by: `src/App.tsx` and `src/index.tsx` entry.

**Feature/Page Layer (`src/features/*`, `src/pages/*`):**
- Purpose: Route-facing UI and user workflows.
- Contains: Home, Profile, Auth pages, Team/Owner admin pages, BusFlow app shell.
- Depends on: shared UI/components/hooks + API modules.
- Used by: `AppRouter` route elements.

**Domain Module Layer (`src/apps/busflow/*`):**
- Purpose: BusFlow domain behavior (routes, customers, settings, map, print).
- Contains: API wrappers, hooks (`useBusflowData`, `useRealtimeSync`), large domain components.
- Depends on: Supabase client and shared helpers.
- Used by: `/busflow` route.

**Shared Platform Layer (`src/shared/*`):**
- Purpose: Cross-feature primitives and contracts.
- Contains:
  - `auth/AuthContext.tsx`
  - `lib/supabase.ts`, `lib/supabaseFunctions.ts`
  - shared APIs (`shared/api/*`)
  - global UI primitives (`shared/ui/*`, `shared/components/*`).
- Depends on: React + Supabase SDK + browser APIs.
- Used by: all route features.

**Backend Layer (`supabase/*`):**
- Purpose: Security-critical mutations, role enforcement, tenant boundaries, onboarding flows.
- Contains: Edge functions and SQL migrations.
- Depends on: Supabase Auth/Postgres/RLS/Function runtime.
- Used by: frontend via `supabase.functions.invoke`, PostgREST, and RPC.

## Data Flow

**Authentication + Session Hydration:**
1. App boots in `src/index.tsx` -> `App` -> `AppProviders`.
2. `AuthProvider` calls `supabase.auth.getSession()`.
3. If session exists, profile + membership are fetched from `profiles` / `account_memberships`.
4. Effective role and active account are derived and exposed via context.
5. Realtime channels refresh auth state on profile/membership changes.

**Protected action through Edge Function (example: profile security):**
1. UI action in Profile page triggers `ProfileSecurityApi`.
2. `invokeAuthedFunction` validates/refreshes JWT and calls function.
3. Edge function validates permissions and executes operation.
4. Structured response maps to toast feedback in UI.

**BusFlow route write path:**
1. UI edits route in BusFlow components.
2. Domain API `saveRouteWithStops()` calls RPC `save_busflow_route_with_stops` with `p_account_id`.
3. Backend validates account scope and concurrency (`updated_at`).
4. UI handles typed domain error codes (`ROUTE_CONFLICT`, `ACCOUNT_ACCESS_DENIED`, etc.).

**State Management:**
- Context + local component state (no external global state library).
- Derived auth/account state from Supabase session + membership rows.
- Realtime event-driven refresh for route/settings consistency.

## Key Abstractions

**Auth Context (`useAuth`):**
- Purpose: Single source for user identity, account context, permission flags.
- Examples: `user`, `activeAccountId`, `canManageTenantUsers`.
- Pattern: React context provider + subscription side effects.

**Function Invocation Guard (`invokeAuthedFunction`):**
- Purpose: Standardize authenticated function calls and JWT retry logic.
- Pattern: wrapper abstraction with typed request/response and auth error normalization.

**BusFlow API Facade (`BusFlowApi`):**
- Purpose: Encapsulate table queries + RPC writes + account scoping.
- Pattern: module facade with shared mapper/util functions.

## Entry Points

**Frontend runtime entry:**
- Location: `src/index.tsx`.
- Trigger: Browser app load.
- Responsibilities: mount React tree with router.

**App composition:**
- Location: `src/App.tsx`.
- Trigger: imported by index entry.
- Responsibilities: provider and router composition.

**Route graph + guards:**
- Location: `src/app/router/AppRouter.tsx`.
- Trigger: navigation events.
- Responsibilities: auth guard, role routes, lazy-loaded route pages, profile action handlers.

**Edge runtime entries:**
- Location: `supabase/functions/*/index.ts`.
- Trigger: HTTPS function invoke.
- Responsibilities: method/auth/permission checks and admin/service mutations.

## Error Handling

**Strategy:**
- Fail at boundaries, map to user-safe messages, keep auth/session failures explicit.

**Patterns:**
- Try/catch around async UI actions with toasts.
- Function call boundary returns `FunctionAuthError` codes for session issues.
- Domain-level `code` errors for RPC conflict and tenant mismatch cases.

## Cross-Cutting Concerns

**Authentication/Authorization:**
- Session-based user context + role derivation in `AuthContext`.
- Function-level auth/role checks in Supabase edge functions.

**Tenant Isolation:**
- Explicit `account_id` filter in PostgREST queries.
- RPC and functions enforce account scope server-side.

**Validation:**
- Input validation at UI and function boundaries (edge functions return typed domain codes).

**Observability:**
- Basic console logging + Vercel Analytics/SpeedInsights.
- Operational validation scripts in `scripts/supabase/` for function boundary checks.

---

*Architecture analysis: 2026-02-26*
*Update when routing/layers/backend contracts change*
