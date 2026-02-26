# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```text
busflow---route-operations-manager/
├── .claude/                  # Local agent profiles/instructions
├── docs/                     # Architecture, migration lineage, runbooks, supabase audits
├── scripts/                  # Operational Node scripts (supabase smoke/e2e)
├── src/                      # Frontend application source
│   ├── app/                  # App shell (providers/router)
│   ├── apps/busflow/         # BusFlow domain module
│   ├── features/             # Feature route wrappers + feature libs
│   ├── pages/                # Legacy route implementations (still active)
│   ├── shared/               # Shared auth/api/lib/ui/components
│   └── test/                 # Global test setup
├── supabase/                 # Supabase functions, migrations, config
│   ├── functions/            # Edge functions + _shared helpers
│   ├── migrations/           # Canonical SQL migration chain
│   └── config.toml           # Function deployment config
├── AGENT.md                  # Project development guide
├── README.md                 # Runtime/setup + operations overview
├── package.json              # npm scripts and dependencies
├── vite.config.ts            # Vite + alias + plugins
├── vitest.config.ts          # Test runner config
├── eslint.config.js          # Lint rules
└── vercel.json               # SPA rewrite rule
```

## Directory Purposes

**`src/app/`:**
- Purpose: App composition, provider mounting, central route graph.
- Key files: `src/app/providers/AppProviders.tsx`, `src/app/router/AppRouter.tsx`, `src/app/router/AuthCallbackNormalizer.tsx`.

**`src/features/`:**
- Purpose: Feature-first facade/wrapper layer.
- Contains: route-facing wrappers for auth/profile/admin/home/busflow + feature shared libs.
- Note: many wrappers delegate to existing `src/pages/*` to keep behavior stable.

**`src/pages/`:**
- Purpose: Legacy core pages with substantial UI/business logic.
- Key files: `PlatformAdmin.tsx`, `TeamAdmin.tsx`, `AcceptInvite.tsx`, `Profile.tsx`, `Register.tsx`, `AccountSecurity.tsx`.

**`src/apps/busflow/`:**
- Purpose: Main domain subsystem.
- Contains: API modules, hooks, map/editor/list/settings/print/customer components.
- Key files: `BusflowApp.tsx`, `api/routes.api.ts`, `hooks/useBusflowData.ts`, `hooks/useRealtimeSync.ts`.

**`src/shared/`:**
- Purpose: Cross-feature infrastructure.
- Contains: auth context, Supabase clients, shared APIs, header/menu/dialog/toast components, UI primitives.

**`supabase/functions/`:**
- Purpose: Server-side privileged operations and security-sensitive workflows.
- Contains: 12 deployed function folders + `_shared` utilities.

**`supabase/migrations/`:**
- Purpose: Canonical DB/RLS evolution path.
- Contains: timestamped migration SQL files + README.

**`scripts/supabase/`:**
- Purpose: Operational verification scripts.
- Files: `smoke-functions.mjs`, `e2e-functions-auth-matrix.mjs`.

## Key File Locations

**Entry Points:**
- `src/index.tsx`: browser mount + router bootstrap.
- `src/App.tsx`: top-level app composition.
- `src/app/router/AppRouter.tsx`: route map + auth guard logic.

**Configuration:**
- `package.json`: scripts (`dev`, `check`, `test`, `build`).
- `.env.example`: required frontend env contract.
- `supabase/config.toml`: function `verify_jwt` settings.
- `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`.

**Core Logic:**
- `src/shared/auth/AuthContext.tsx`: identity + account context.
- `src/shared/lib/supabaseFunctions.ts`: authenticated function invoke guard.
- `src/apps/busflow/api/*.api.ts`: domain data access/RPC layer.
- `src/shared/api/admin/*.api.ts`: owner/admin function wrappers.

**Testing:**
- Co-located tests: e.g., `src/features/auth/lib/auth-callback.test.ts`, `src/pages/Profile.test.tsx`.
- Global setup: `src/test/setup.ts`.

**Documentation:**
- `AGENT.md`, `README.md`, `SUPABASE_MANIFEST.md`, `SUPABASE_EDGE_FUNCTION_SETUP.md`.
- Architecture and audits under `docs/architecture/` and `docs/supabase/`.

## Naming Conventions

**Files:**
- React components/pages: PascalCase (`Profile.tsx`, `RouteEditor.tsx`).
- APIs/hooks/libs: kebab/camel mixed with suffixes (`profileSecurity.api.ts`, `useRealtimeSync.ts`).
- Tests: `*.test.ts` / `*.test.tsx` colocated near source.

**Directories:**
- Feature/domain folders are lowercase with separators (`features/admin/platform`, `apps/busflow/components/settings`).
- Shared contracts centralized under `src/shared/*`.

**Special Patterns:**
- `*.api.ts` for API boundary modules.
- `Page.tsx` wrappers in `src/features/*/pages`.
- `_shared/` in Supabase functions for shared Deno helpers.

## Where to Add New Code

**New route-facing feature:**
- Primary UI entry: `src/features/<feature>/pages/`.
- Shared state/API: `src/shared/*` or feature-local `lib/api`.
- If legacy route still active, bridge to existing page first then migrate.

**New BusFlow behavior:**
- Domain UI/hooks: `src/apps/busflow/components` and `src/apps/busflow/hooks`.
- Data access: `src/apps/busflow/api`.
- Tenant-safe writes should prefer existing RPC/function pathways.

**New Edge Function:**
- Add folder under `supabase/functions/<function-name>/index.ts`.
- Reuse helpers from `supabase/functions/_shared/*`.
- Register in `supabase/config.toml` and setup docs.

**New tests:**
- Place adjacent to unit under test (`*.test.ts(x)`).
- Use global test setup from `src/test/setup.ts`.

## Special Directories

**`dist/`:**
- Purpose: Vite production build output.
- Source: generated by `npm run build`.
- Committed: No (build artifact).

**`.planning/codebase/`:**
- Purpose: generated codebase maps for planning workflows.
- Source: `$gsd-map-codebase` workflow.
- Committed: typically yes (project documentation artifact).

**`components/` and `lib/` (root-level):**
- Currently no active source files; treat as cleanup candidates unless reintroduced intentionally.

---

*Structure analysis: 2026-02-26*
*Update when directories/routes/modules shift*
