---
name: "BusFlow TypeScript React Vite Development Guide"
description: "A comprehensive development guide for building and operating the BusFlow web application using TypeScript, React, Vite, Tailwind CSS, Supabase, and account-scoped multi-tenant patterns."
category: "Web Application Framework"
author: "Agents.md Collection (adapted for BusFlow)"
authorUrl: "https://github.com/gakeez/agents_md_collection"
tags:
  [
    "typescript",
    "react",
    "vite",
    "tailwindcss",
    "supabase",
    "react-router",
    "multi-tenant",
    "route-operations",
  ]
lastUpdated: "2026-02-28"
---

# BusFlow TypeScript React Vite Development Guide

## Project Overview

This guide defines best practices for developing and operating BusFlow as a web application. The project is built with TypeScript, React, and Vite, with Supabase used for authentication, database access, row-level security (RLS), realtime synchronization, and edge functions. The architecture is account-scoped and designed for tenant isolation via `account_id`.

## Tech Stack

- **Framework**: React 19 (web)
- **Build Tool**: Vite 6
- **Language**: TypeScript 5.8+
- **Routing**: React Router v6
- **Styling**: Tailwind CSS v4
- **UI Utilities**: shadcn-style setup + class-variance-authority + lucide-react
- **Backend Platform**: Supabase (`@supabase/supabase-js` v2)
- **Backend Runtime Extensions**: Supabase Edge Functions
- **Linting**: ESLint 9 + TypeScript ESLint + React Hooks plugin
- **Observability**: Vercel Analytics + Vercel Speed Insights

## Agent Tooling

- MCP server usage is available for this agent workflow.
- Prefer MCP resources and templates when they provide relevant project context.

## Development Environment Setup

### Installation Requirements

- Node.js 18+ (Node.js 20+ recommended)
- npm 9+
- Supabase CLI (required only for local backend workflows/migrations)

### Installation Steps

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run TypeScript checks
npm run typecheck

# Run linting
npm run lint

# Required local quality gate
npm run check

# Build production bundle
npm run build
```

### Environment Variables

Create `.env.local` and define:

```bash
VITE_SUPABASE_URL=https://YOUR-DEV-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_DEV_ANON_KEY
VITE_PLATFORM_OWNER_EMAIL=owner@your-domain.tld
VITE_PASSWORD_RESET_REDIRECT_URL=https://your-domain.tld/auth/accept-invite
```

Function secrets (Supabase-side, not `VITE_` vars):

```bash
APP_INVITE_REDIRECT_URL=https://<your-domain>/auth/accept-invite
APP_PASSWORD_RESET_REDIRECT_URL=https://<your-domain>/auth/accept-invite
PLATFORM_OWNER_EMAIL=owner@your-domain.tld
```

## Project Structure

```text
busflow---route-operations-manager/
├── src/
│   ├── App.tsx
│   ├── index.tsx
│   ├── index.css
│   ├── apps/
│   │   └── busflow/
│   │       ├── BusflowApp.tsx
│   │       ├── api/
│   │       │   ├── index.ts
│   │       │   ├── routes.api.ts
│   │       │   ├── settings.api.ts
│   │       │   ├── customers.api.ts
│   │       │   ├── contacts.api.ts
│   │       │   ├── import.api.ts
│   │       │   └── shared.ts
│   │       ├── hooks/
│   │       │   ├── useBusflowData.ts
│   │       │   ├── useRealtimeSync.ts
│   │       │   └── useRouteFiltering.ts
│   │       ├── components/
│   │       └── utils/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Profile.tsx
│   │   ├── TeamAdmin.tsx
│   │   ├── PlatformAdmin.tsx
│   │   ├── Register.tsx
│   │   └── AcceptInvite.tsx
│   └── shared/
│       ├── auth/AuthContext.tsx
│       ├── lib/supabase.ts
│       └── components/
├── components/
│   └── ui/
│       └── background-shader.tsx
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
│       ├── _shared/
│       ├── invite-account-user/
│       ├── admin-manage-invitation-v1/
│       ├── admin-update-membership-role-v1/
│       ├── platform-provision-account/
│       ├── platform-delete-account/
│       ├── owner-company-overview-v1/
│       └── ...
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Core Development Principles

### Code Style and Structure

- Use strict TypeScript interfaces for domain models and context contracts.
- Keep business logic in `src/apps/busflow/api/*` and `src/apps/busflow/hooks/*`, not in route-level render blocks.
- Keep account scoping explicit and centralized (`setActiveAccountId`, `requireActiveAccountId`).
- Favor named exports for API and hook modules.

```typescript
// Example role model from AuthContext domain
export type Role = "ADMIN" | "DISPATCH" | "VIEWER";

export interface AccountSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  trialState?: "TRIAL_ACTIVE" | "TRIAL_ENDED" | "SUBSCRIBED";
  trialEndsAt?: string;
}
```

### Tailwind and Component Patterns

- Use utility-first classes for layout/state styling.
- Keep shared primitives in `src/shared/components/*` and UI utilities in `components/ui/*`.
- Keep auth shells and viewport providers centralized to avoid duplicate scaffolding.

```tsx
<button
  type="submit"
  disabled={isLoggingIn}
  className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
>
  {isLoggingIn ? "Verarbeite..." : "Anmelden"}
</button>
```

## State Management and Data Fetching

### Auth and Session State (Context-based)

BusFlow uses React Context for auth state, user role derivation, active account resolution, and session-driven profile refresh.

```typescript
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccount, setActiveAccount] = useState<AccountSummary | null>(null);

  // Session bootstrap + auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id, session.user.email);
    });
  }, [fetchProfile]);

  return <AuthContext.Provider value={{ user, activeAccountId, activeAccount, ... }}>{children}</AuthContext.Provider>;
};
```

### Domain Data via API Modules + Hooks

Domain reads/writes are organized in API modules (`BusFlowApi`) and consumed by dedicated hooks.

```typescript
export function useBusflowData(activeAccountId: string | null): BusflowData {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    BusFlowApi.setActiveAccountId(activeAccountId);
  }, [activeAccountId]);

  // Parallel initial load
  useEffect(() => {
    if (!activeAccountId) return;
    Promise.all([
      BusFlowApi.getRoutes(),
      BusFlowApi.getBusTypes(),
      BusFlowApi.getWorkers(),
      BusFlowApi.getCustomersForSuggestions(),
    ]).then(([fetchedRoutes, fetchedBusTypes, fetchedWorkers, fetchedCustomers]) => {
      setRoutes(fetchedRoutes);
      setBusTypes(fetchedBusTypes);
      setWorkers(fetchedWorkers);
      setCustomers(fetchedCustomers);
    });
  }, [activeAccountId]);

  return { routes, busTypes, workers, customers, ... };
}
```

### Realtime Synchronization

BusFlow listens to account-scoped Supabase channel events and refreshes route/settings data with debounce-like scheduling.

```typescript
const accountFilter = `account_id=eq.${activeAccountId}`;
supabase
  .channel(`busflow-live-sync-${activeAccountId}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "busflow_routes", filter: accountFilter }, scheduleRoutesRefresh)
  .on("postgres_changes", { event: "*", schema: "public", table: "busflow_stops", filter: accountFilter }, scheduleRoutesRefresh)
  .on("postgres_changes", { event: "*", schema: "public", table: "busflow_bus_types", filter: accountFilter }, scheduleSettingsRefresh)
  .subscribe();
```

## Navigation and Routing

BusFlow uses React Router with explicit guarded routes for owner/admin/member contexts.

```tsx
<Routes>
  <Route path="/" element={<Home ... />} />
  <Route path="/busflow" element={<BusflowApp ... />} />
  <Route path="/owner-bereich" element={user.isPlatformOwner ? <PlatformAdmin ... /> : <Navigate to="/adminbereich" replace />} />
  <Route path="/adminbereich" element={canManageTenantUsers ? <TeamAdmin ... /> : <Navigate to="/" replace />} />
  <Route path="/auth/accept-invite" element={<AcceptInvite />} />
  <Route path="/profile" element={<Profile ... />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Routing guidance:

- Keep legacy admin URLs redirected to canonical paths (`/adminbereich`, `/owner-bereich`).
- Keep auth callback normalization in `App.tsx` to recover tokens if provider redirects to unexpected paths.
- Keep invite and password reset completion flow on `/auth/accept-invite`.

## Backend/Supabase Integration

### Supabase Client Initialization

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Canonical Route Write Path (RPC)

All route + stop updates must go through `save_busflow_route_with_stops` with account scoping and optimistic concurrency.

```typescript
await supabase.rpc("save_busflow_route_with_stops", {
  p_account_id: accountId,
  p_route_id: route.id,
  p_expected_updated_at: expectedUpdatedAt || null,
  p_route: { ...routePayload },
  p_stops: route.stops,
});
```

### Account-Scoped Access Rules

- Every tenant-facing query must filter by `account_id` or use account-aware RPC inputs.
- Frontend API modules must require an active account via `requireActiveAccountId()`.
- Treat `ACCOUNT_REQUIRED`, `ACCOUNT_ACCESS_DENIED`, and `ACCOUNT_MISMATCH` as first-class errors.
- Keep RLS assumptions explicit in docs and migration comments.

### Invite and Password Reset Flow

- Invite onboarding is handled via `/auth/accept-invite`.
- Password reset redirects to the same canonical path unless overridden by `VITE_PASSWORD_RESET_REDIRECT_URL`.
- Invitation handling and role assignment are coordinated through edge functions and SQL helpers.

### Edge Functions in Scope

Use dedicated edge functions for privileged or workflow-heavy operations, including:

- `invite-account-user`
- `admin-manage-invitation-v1`
- `admin-update-membership-role-v1`
- `admin-update-user-v1`
- `admin-delete-user-v3`
- `platform-provision-account`
- `platform-delete-account`
- `platform-send-password-reset`
- `owner-company-overview-v1`
- `owner-update-account-v1`
- `public-register-trial-v1`

## Build/Quality/Operations

### Build and Checks

- `npm run dev`: local development server
- `npm run typecheck`: TypeScript compile check (`--noEmit`)
- `npm run lint`: ESLint for TS/TSX/JS/JSX
- `npm run check`: required local gate (`typecheck + lint + build`)
- `npm run build`: production build via Vite

### Testing Reality (Current)

- The repository currently has **no automated unit/integration/E2E test suite**.
- The practical quality baseline is passing `npm run check`.
- When adding non-trivial behavior, prioritize:
  - deterministic pure-function extraction,
  - API boundary checks,
  - guard-rail error handling for Supabase error codes.

### Migration and SQL Governance

- Use `supabase/migrations/` as the operational source of truth.
- Treat `docs/migrations/` as historical archive/reference.
- Avoid manual production SQL drift outside migration workflow.

## Best Practices Summary

### Code Quality and Structure

- Keep account-scoped boundaries explicit in all data writes and reads.
- Keep route-domain logic under `src/apps/busflow/`.
- Keep shared cross-feature concerns under `src/shared/`.

### TypeScript and Validation

- Keep strict interfaces around domain entities (`Route`, `Stop`, `Customer`, roles).
- Normalize backend payloads in API mapping helpers before UI usage.
- Prefer explicit string union types over enums for roles/status values.

### Frontend and UX

- Use React Router route guards for owner/admin/member experiences.
- Use Tailwind utility classes consistently for predictable styling.
- Keep feedback immediate with Toast + Progress providers for async operations.

### Supabase and Security

- Keep `anon` keys only in frontend, never service role keys.
- Keep privileged logic in Edge Functions and SQL policies.
- Keep tenant isolation enforced through `account_id` everywhere.

### Operations

- Run `npm run check` before PRs and releases.
- Keep edge function secrets out of frontend env files.
- Keep migration-first discipline for all schema and RLS changes.

This guide provides a BusFlow-specific foundation for maintaining a scalable, account-scoped React web application with Supabase-backed auth, data integrity, and operational discipline.
