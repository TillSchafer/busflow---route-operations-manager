# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Dispatch Protocol

For every non-trivial task (new features, refactors, debugging, architecture decisions, multi-file changes):

1. **Consult `~/.claude/agents/agent-organizer.md`** — identify the optimal agent team for the task
2. **Read the recommended agent files** from `~/.claude/agents/` (e.g. `react-pro.md`, `code-reviewer.md`, `postgres-pro.md`) — adopt their guidelines and expertise
3. **Apply their standards** throughout implementation

Available agents in `~/.claude/agents/`:
- `agent-organizer` — meta-agent: analyzes task and recommends team
- `react-pro`, `typescript-pro`, `frontend-developer`, `full-stack-developer`, `backend-architect`
- `postgres-pro`, `database-optimizer`, `graphql-architect`
- `code-reviewer`, `debugger`, `qa-expert`, `test-automator`, `architect-review`
- `security-auditor`, `performance-engineer`, `deployment-engineer`, `cloud-architect`
- `api-documenter`, `documentation-expert`, `product-manager`

For deep project background: `docs/ai/AGENT.md` (BusFlow dev guide) and `docs/ai/system-context.md` (full system context).

## Commands

```bash
npm run dev          # Start Vite dev server
npm run test         # Run all tests (vitest, single pass)
npm run test:watch   # Run tests in watch mode
npm run typecheck    # TypeScript check without emit
npm run lint         # ESLint (TS + React hooks)
npm run check        # Local quality gate: typecheck + lint + build (run before committing)
npm run build        # Production build
```

Run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

## Environment

Create `.env.local` with:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PLATFORM_OWNER_EMAIL` — email of the platform owner (unlocks `/owner-bereich`)
- `VITE_PASSWORD_RESET_REDIRECT_URL` — optional, defaults to `<origin>/auth/accept-invite`

## Architecture

### Tech Stack
React 19 + TypeScript SPA, built with Vite. Supabase handles auth, Postgres DB with RLS, realtime subscriptions, and edge functions. Deployed to Vercel.

### Source Layout

```
src/
  app/           # Entry wiring: AppProviders (context stack), AppRouter (route tree)
  features/      # Page-level feature slices (auth, admin, busflow, home, profile)
  apps/busflow/  # Core BusFlow app: BusflowApp.tsx, api/, components/, hooks/, types.ts
  shared/        # Cross-cutting: auth, api, components, hooks, lib, loading, ui
```

The `features/busflow/pages/BusflowAppPage.tsx` is a thin re-export of `apps/busflow/BusflowApp`. The `apps/busflow/` directory contains all business logic for the route management app.

### Auth & Multi-Tenancy

`AuthContext` (`src/shared/auth/AuthContext.tsx`) bootstraps on mount by calling `supabase.auth.getSession()` and subscribes to `onAuthStateChange`. It fetches the user's `profiles` row and their first active `account_memberships` row.

Two role dimensions:
- **Global role** (`profiles.global_role`): `ADMIN` | `USER` — platform-level; admins bypass tenant restrictions
- **Membership role** (`account_memberships.role`): `ADMIN` | `DISPATCH` | `VIEWER` — scoped to a `platform_accounts` row

`useAuth()` exposes `user`, `activeAccountId`, `activeAccount`, and `canManageTenantUsers`. Realtime channels on `profiles` and `account_memberships` re-fetch on any change.

Routing logic in `AppRouter`:
1. Unauthenticated → login screen (or `/auth/accept-invite`, `/auth/register`)
2. Authenticated but no `activeAccountId` and not platform admin → "pending account" screen
3. Authenticated + account → full app

### BusFlow API Layer

All BusFlow data access goes through `BusFlowApi` (`src/apps/busflow/api/index.ts`), a flat object aggregating named exports from `routes.api.ts`, `customers.api.ts`, `contacts.api.ts`, `settings.api.ts`, `import.api.ts`.

**Critical pattern**: `BusFlowApi.setActiveAccountId(accountId)` must be called before any API call. `requireActiveAccountId()` in `shared.ts` throws `ACCOUNT_REQUIRED` if it hasn't been set.

**Route write path**: All route+stop saves go through the Postgres RPC `save_busflow_route_with_stops` via `BusFlowApi.saveRouteWithStops`. Direct inserts/updates to `busflow_routes` bypass the concurrency guard. The RPC uses optimistic locking via `updated_at` and returns structured `{ ok, code }` error shapes that are translated to `ErrorWithCode` (typed string codes).

**Error codes**: Errors from the API layer carry a `.code` string (e.g., `ROUTE_CONFLICT`, `CUSTOMER_REQUIRED`, `ACCOUNT_REQUIRED`). Use `getErrorCode()` / `getErrorMessage()` from `src/shared/lib/error-mapping.ts` to extract them.

### Realtime Sync

`useRealtimeSync` (`src/apps/busflow/hooks/useRealtimeSync.ts`) subscribes to Supabase postgres_changes on the BusFlow tables and triggers `refreshRoutes` / `refreshSettingsData` callbacks. Auth-level realtime (profile/membership changes) is handled directly in `AuthContext`.

### Loading System

`LoadingProvider` + `AppLoadingBridge` control a full-page loading overlay with scoped message keys. Use `LoadingMessageKey` values (`auth.bootstrap`, `route.transition`, `action.save`, etc.) — do not use ad-hoc strings. The bridge is rendered inside `AppRouter` and activated by setting the appropriate message key.

### Supabase Edge Functions

Located in `supabase/functions/`. Called from the frontend via `src/shared/lib/supabaseFunctions.ts`. Auth errors from edge functions are detected by `isFunctionAuthError()`. Secrets (not `VITE_` env) must be set in Supabase Function secrets.

### Database Conventions

- Source of truth: `supabase/migrations/` only. Files under `docs/migrations/` and `sql/legacy/` are archives.
- All tables are account-scoped via `account_id` FK referencing `platform_accounts`.
- RLS is enforced at the DB level; the app also guards at the API layer.
- `busflow_customers` uses a company + multi-contact model (`busflow_customer_contacts` with FK).

### UI Conventions

- Tailwind utility classes for all styling (Tailwind v4 via `@tailwindcss/vite`)
- German locale: all user-visible strings, status values (`Aktiv`, `Geplant`, `Entwurf`, `Archiviert`), and route labels are in German
- Shared UI primitives in `src/shared/ui/` and `src/shared/components/`; avoid duplicating them
- Toast notifications via `useToast()` → `pushToast({ type, title, message })`

### Testing

Vitest + jsdom + `@testing-library/react`. Setup file at `src/test/setup.ts`. Tests live alongside the code they test (e.g., `hooks/useRouteFiltering.test.ts`). Supabase client is mocked in tests.
