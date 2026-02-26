# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- TypeScript 5.8 - Frontend application code in `src/` and typed API utilities.

**Secondary:**
- JavaScript (ESM) - Node operational scripts in `scripts/supabase/*.mjs`.
- SQL - Schema and policy evolution in `supabase/migrations/*.sql`.
- CSS - Tailwind v4 entry + theme tokens in `src/index.css`.

## Runtime

**Environment:**
- Browser runtime for SPA (React Router client-side routing).
- Node.js runtime for local dev/build/test CLI (`vite`, `vitest`, `eslint`, `supabase` CLI).
- Deno runtime for Supabase Edge Functions in `supabase/functions/*`.

**Package Manager:**
- npm (lockfile present: `package-lock.json`).
- No pinned Node version file found (`.nvmrc` / `.node-version` absent).

## Frameworks

**Core:**
- React 19.2 (`react`, `react-dom`) - UI framework.
- React Router 6.26 (`react-router-dom`) - route handling and navigation guards.
- Supabase JS 2.95 (`@supabase/supabase-js`) - Auth, PostgREST, RPC, Realtime, Functions invoke.

**Styling/UI:**
- Tailwind CSS 4.2 + `@tailwindcss/vite` plugin.
- `tw-animate-css` + `shadcn/tailwind.css` imports in `src/index.css`.
- `lucide-react` for iconography.

**Testing:**
- Vitest 4.0 + jsdom.
- React Testing Library + `@testing-library/jest-dom` + `@testing-library/user-event`.

**Build/Dev:**
- Vite 6.4 (`vite`, `@vitejs/plugin-react`) for dev server and production bundling.
- TypeScript compiler with `tsc --noEmit` quality gate.
- ESLint 9 + `@typescript-eslint` + `eslint-plugin-react-hooks`.

## Key Dependencies

**Critical application dependencies:**
- `@supabase/supabase-js` - All auth/session, DB queries, RPC writes, realtime channels, edge-function invocation.
- `react-router-dom` - App route graph (`/`, `/busflow`, `/profile`, `/adminbereich`, `/owner-bereich`, `/auth/*`).
- `tailwindcss` - Utility-first UI styling and design tokens.
- `@vercel/analytics` and `@vercel/speed-insights` - Runtime telemetry in `src/app/providers/AppProviders.tsx`.

**Operational dependencies:**
- `supabase` CLI - Function/secrets/migration workflows.
- `vitest` + testing-library stack - Minimal unit/component regression safety.

## Configuration

**Environment:**
- Client env keys (from `.env.example`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_PLATFORM_OWNER_EMAIL`
  - `VITE_PASSWORD_RESET_REDIRECT_URL`
  - `VITE_ACCOUNT_SECURITY_REDIRECT_URL`
- Edge function secrets documented separately (e.g. `APP_INVITE_REDIRECT_URL`, `APP_PASSWORD_RESET_REDIRECT_URL`, `APP_ACCOUNT_SECURITY_REDIRECT_URL`, `PLATFORM_OWNER_EMAIL`).

**Build / Tooling config:**
- `vite.config.ts` (React plugin, Tailwind plugin, alias `@ -> .`).
- `tsconfig.json` (ES2022 target, bundler module resolution, alias paths).
- `eslint.config.js` (TypeScript + hooks rules, Node override for `scripts/**/*.mjs`).
- `vitest.config.ts` (jsdom, setup file, same alias/plugins).
- `vercel.json` (SPA rewrite to `index.html`).

## Platform Requirements

**Development:**
- Node + npm environment.
- Access to a Supabase project and valid anon URL/key.
- Supabase CLI for migrations/functions operations.

**Production:**
- Frontend deployment on Vercel-compatible static host (SPA rewrite required).
- Supabase project (Auth, Postgres, Edge Functions, Realtime).
- Runtime config via hosting env vars + Supabase function secrets.

---

*Stack analysis: 2026-02-26*
*Update after major dependency/runtime changes*
