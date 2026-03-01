# Stack Research

**Domain:** BusPilot v1.1 stabilization (performance, validation, settings, lifecycle, authorization, launch-ready DB)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.3 | UI composition for BusFlow/admin/profile flows | Already deployed in the app; supports current provider + lazy route architecture without rework |
| React Router DOM | 6.30.3 | Route-level splitting and guarded visibility flows | Existing route boundary in `src/app/router/AppRouter.tsx`; best place to continue load-time improvements |
| TypeScript | 5.8.3 | Typed domain contracts for route/settings/auth role logic | Needed to lock request/response shapes while finalizing validations and visibility rules |
| Vite | 6.4.1 | Build/chunk output and fast iteration for load-time optimization | Existing bundler; supports chunk tuning and regression checks without architecture changes |
| Supabase JS (frontend) | 2.95.3 | Auth, PostgREST, RPC, Realtime, and function invocation from SPA | Existing integration path in `src/shared/lib/supabase.ts` and `src/apps/busflow/api/*.api.ts` |
| Supabase Edge Functions runtime | Deno std `0.224.0` + `@supabase/supabase-js@2.49.1` | Security-critical role/delete/archive operations | Existing production execution model in `supabase/functions/*`; keep and harden rather than replace |
| Supabase Postgres + SQL migrations | Managed (project), migrations in repo | Launch-readiness via constraints, indexes, and policy hardening | Current source of truth is `supabase/migrations/`; matches existing operational workflow |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 3.24.x (add) | Shared schema validation for route creation/settings payloads | Use at client submit boundaries and edge-function request parsing where current checks are ad-hoc |
| `@vercel/speed-insights` | 1.3.1 | Production web-vitals baseline for load-time work | Use to verify v1.1 load-time changes in real traffic segments |
| `@vercel/analytics` | 1.6.1 | Event-level tracking for slow route/settings actions | Use for before/after measurement of optimization work |
| Native `AbortController` | Browser standard | Cancel stale list/settings requests during navigation | Use in data-loading hooks where overlapping requests can waste bandwidth/render time |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 4.0.18 + Testing Library | Regression coverage for route validation, role visibility, and delete/archive behaviors | Extend existing co-located tests; prioritize auth/role and route CRUD boundary tests |
| Supabase CLI 2.76.14 | Migration and edge-function deployment workflow | Continue using migration-first DB evolution in `supabase/migrations/` |
| ESLint 9.39.3 + TypeScript ESLint 8.56.1 | Prevent unsafe or inconsistent validation/authorization patterns | Keep `npm run check` as release gate for v1.1 stabilization |

## v1.1 Integration Points (Goals Only)

| Milestone Goal | Integration Points | Stack Change/Additions |
|----------------|--------------------|------------------------|
| Load-time optimization | `src/app/router/AppRouter.tsx`, `src/shared/loading/*`, `src/apps/busflow/hooks/useBusflowData.ts` | Keep Vite + Router lazy boundaries; instrument with Speed Insights/Analytics already present |
| Route creation validations | `src/apps/busflow/api/routes.api.ts`, `src/apps/busflow/components/RouteEditor.tsx`, RPC `save_busflow_route_with_stops` | Add `zod` schemas for client + function/RPC boundary parity; keep existing error-code mapping |
| User settings finalization | `src/apps/busflow/api/settings.api.ts`, `src/apps/busflow/components/settings/*`, `src/features/profile/pages/ProfilePage.tsx` | Standardize validation and typed payload guards; no new form framework required |
| Delete/archive concept finalization | `src/apps/busflow/api/*delete*`, `supabase/functions/platform-delete-account`, `supabase/functions/owner-update-account-v1` | Keep edge-function + SQL approach; finalize archive columns/rules before adding new delete paths |
| Role/visibility finalization | `src/shared/auth/AuthContext.tsx`, `src/features/admin/*`, `supabase/functions/admin-update-membership-role-v1` | Keep UI guard + function authorization model; tighten consistency between frontend role derivation and backend checks |
| DB launch-readiness | `supabase/migrations/*.sql`, RLS/policies, uniqueness/foreign-key/index tuning | Stay migration-driven; prioritize constraints/policies over introducing ORM/secondary data layer |

## Installation

```bash
# Core additions for v1.1
npm install zod

# No mandatory new framework/state/runtime packages
# Existing dependencies remain primary
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `zod` schemas at boundaries | Hand-written `if` checks only | Only for tiny one-off checks; not for shared route/settings/business validation contracts |
| Existing Vite + Router chunk strategy | Migrating to SSR framework for performance | Only if SEO/server-rendering becomes a product requirement (not in v1.1 scope) |
| Supabase SQL migrations + RLS + functions | Introducing Prisma/ORM abstraction layer | Only for larger backend rewrite milestones; too disruptive for v1.1 stabilization |
| Archive-first lifecycle for business entities | Hard-delete-only model | Only for truly disposable data with no audit/recovery requirement |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New global state framework (`redux`, `mobx`, etc.) | Adds migration risk without solving v1.1 goals | Keep existing context/hook architecture (`AuthContext`, loading, feature hooks) |
| New backend service layer (Nest/Fastify/BFF) | Breaks preservation constraint and adds auth surface | Keep Supabase + edge functions and harden existing endpoints |
| ORM-first refactor of DB access | High churn and policy drift risk late in milestone | Continue PostgREST/RPC/functions + migration-first SQL |
| Feature expansion packages unrelated to goals | Increases bundle size and launch risk | Restrict additions to validation/perf measurement needs only |

## Explicit Do-Not-Add Guidance

- Do not add Next.js/SSR, React Query migration, or state-management rewrites in v1.1.
- Do not introduce a second API/backend layer alongside Supabase for this milestone.
- Do not replace route CRUD/auth core concepts; improve validations and authorization around them.
- Do not add non-goal UI libraries that increase bundle weight during load-time optimization work.

## Stack Patterns by Variant

**If operation is user-facing and latency-sensitive (route lists, route open/save):**
- Use existing React Router lazy boundaries + loading bridge + measured web-vitals events.
- Because v1.1 needs measurable load-time gains without architecture replacement.

**If operation mutates critical business data (route create/save, role updates, delete/archive):**
- Use layered validation and authorization: UI boundary schema -> API/function checks -> DB constraints/RLS.
- Because launch-readiness depends on consistency across client, edge function, and database layers.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react@19.2.3` | `react-dom@19.2.3` | Current runtime pair in lockfile |
| `react@19.2.3` | `react-router-dom@6.30.3` | Existing router/lazy setup in `AppRouter.tsx` |
| `vite@6.4.1` | `@vitejs/plugin-react@5.1.2` | Current build pipeline pair |
| `tailwindcss@4.2.1` | `@tailwindcss/vite@4.2.1` | Current styling integration |
| `@supabase/supabase-js@2.95.3` (SPA) | Edge functions using `@supabase/supabase-js@2.49.1` | Works today; track and plan controlled version alignment after v1.1 hardening |
| `zod@3.24.x` | `typescript@5.8.3` | Suitable for strongly typed schema inference in current TS config |

## Sources

- `.planning/PROJECT.md` - v1.1 goal scope and constraints
- `package-lock.json` / `package.json` - current resolved dependency versions
- `src/app/router/AppRouter.tsx` - route/lazy/loading integration boundary
- `src/apps/busflow/api/routes.api.ts` and `src/apps/busflow/api/settings.api.ts` - validation and CRUD boundary points
- `src/shared/auth/AuthContext.tsx` - role derivation and visibility baseline
- `supabase/functions/*` and `supabase/config.toml` - current function runtime/auth model
- `supabase/migrations/*.sql` - DB launch-readiness migration workflow

---
*Stack research for: BusPilot v1.1 stabilization on existing architecture*
*Researched: 2026-03-01*
