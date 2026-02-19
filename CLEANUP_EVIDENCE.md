# Cleanup Evidence Log

This file tracks evidence-based cleanup decisions.

## Entry Points / Routing / Dynamic Imports

- Entrypoint: `src/index.tsx` -> renders `<App />` inside `BrowserRouter`.
- Route root: `src/App.tsx` with routes:
  - `/` -> `src/pages/Home.tsx`
  - `/busflow` -> `src/apps/busflow/BusflowApp.tsx`
  - `/admin` -> `src/pages/Admin.tsx`
  - `/profile` -> `src/pages/Profile.tsx`
- Dynamic imports: none found (`rg "lazy\(|import\(" src` returned no results).
- Env-driven runtime usage:
  - `src/shared/lib/supabase.ts` uses `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  - Edge function env usage is inside `supabase/functions/invite-account-user/index.ts`.

## Static Reference Graph Snapshot

- Source files scanned: 31 (`src/**/*.{ts,tsx,js,jsx}`)
- Potentially unreferenced files from static graph:
  - `src/apps/busflow/components/PassengerChart.tsx`
  - `src/vite-env.d.ts` (expected, TS declaration file)

## Candidate Decisions

| Path | Claim | Evidence | Decision | Risk |
|---|---|---|---|---|
| `src/apps/busflow/components/PassengerChart.tsx` | Unused UI component | No import references (`rg -n "PassengerChart" src` only hits file itself), no route usage, no dynamic imports | DELETE | Low |
| `src/vite-env.d.ts` | Potentially unreferenced | Not imported by runtime code; required by TypeScript compiler setup | KEEP | Low |
| `components/` (top-level) | Empty directory | `find components -type f` => 0 files | HOLD (non-impacting) | Low |
| `sql/legacy/fix_rls.sql` | Legacy artifact | Referenced by docs (`README.md`, `CONTEXT.md`, `BACKEND_CLEANUP_REPORT.md`) as archived script | KEEP | Low |

## Phase A Actions Executed

- Deleted verified unused component:
  - `src/apps/busflow/components/PassengerChart.tsx`
- Dependency follow-up from same evidence:
  - removed `recharts` (was only referenced by deleted file).

## Validation (after current package)

- `npm run test` -> PASS
- `npm run check` -> PASS

