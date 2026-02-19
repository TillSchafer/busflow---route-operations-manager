# BusFlow Route Operations Manager

BusFlow is a React + Vite app with Supabase auth, database, RLS, and realtime sync.

## Stack
- React 19 + TypeScript
- Vite
- Supabase (`@supabase/supabase-js`)
- Tailwind utility classes

## Local Development
1. Install dependencies:
   `npm install`
2. Create `.env.local` with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Start dev server:
   `npm run dev`
4. Build production bundle:
   `npm run build`

## Supabase Migration Map
- `supabase_schema.sql`: initial baseline schema (historical base)
- `supabase_migration_workers.sql`: workers table
- `supabase_migration_phase3.sql`: legacy `customer_name` route column
- `supabase_migration_phase4.sql`: status migration to German statuses
- `supabase_migration_phase5.sql`: route operational fields
- `supabase_migration_phase6.sql`: bus number + stop geo/actual times
- `supabase_migration_phase7_roles.sql`: admin/app-permission model + signup defaults
- `supabase_migration_phase8_customers.sql`: customer master table + RLS
- `supabase_migration_phase9_concurrency.sql`: `updated_at` + atomic route save RPC
- `supabase_migration_phase10_customer_fk.sql`: `customer_id` FK + backfill + RPC FK support
- `supabase_migration_phase11_customer_name_cleanup.sql`: deprecated for hybrid mode (do not run when free-text customer is required)
- `supabase_migration_phase12_backend_cleanup.sql`: canonical trigger/RPC cleanup + policy checks
- `supabase_migration_phase13_map_default_settings.sql`: persisted default map center/zoom for new routes
- `supabase_migration_phase14_customer_hybrid_restore.sql`: restores `customer_name` for hybrid free-text + optional FK model
- `supabase_migration_phase14b_customer_hybrid_rpc.sql`: canonical hybrid RPC write for `customer_id` + `customer_name`

## Canonical Backend Write Path
- Routes + stops are saved through RPC: `save_busflow_route_with_stops`
- Frontend write entrypoint: `BusFlowApi.saveRouteWithStops(...)`
- Concurrency guard: optimistic lock via `updated_at`

## Legacy Scripts
- Deprecated SQL helpers are archived in `sql/legacy/`.
- Do not execute archived scripts in production.
