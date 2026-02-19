# BusFlow Route Operations Manager

BusFlow is a React + Vite app with Supabase auth, database, RLS, and realtime sync.

## Stack
- React 19 + TypeScript
- Vite
- Supabase (`@supabase/supabase-js`)
- Tailwind utility classes

## Quality Gates
- `npm run typecheck` -> TypeScript compile check without emit
- `npm run lint` -> ESLint (TypeScript + React hooks)
- `npm run check` -> required local gate (`typecheck + lint + build`)

## Local Development
1. Install dependencies:
   `npm install`
2. Create `.env.local` with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Start dev server:
   `npm run dev`
4. Run quality gate:
   `npm run check`
5. Build production bundle:
   `npm run build`

## Supabase SQL Governance
- Source of truth is **migrations only**: `supabase_migration_*.sql`
- `supabase_schema.sql` is legacy reference and is **not** operational
- Deprecated scripts live in `sql/legacy/` and must not be executed in production

## Supabase Migration Map
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
- `supabase_migration_phase15_customer_import_fields.sql`: customer contact fields + metadata for CSV import
- `supabase_migration_phase16_customer_search_indexes.sql`: customer search indexes for scalable filtering
- `supabase_migration_phase17_customer_contacts.sql`: company + multi-contact model + route contact FK
- `supabase_migration_phase17b_customer_contacts_rpc.sql`: canonical route+stops RPC with `customer_contact_id`
- `supabase_migration_phase18_sql_governance.sql`: migration-first governance comments + trigger/policy/index sanity checks

## Canonical Backend Write Path
- Routes + stops are saved through RPC: `save_busflow_route_with_stops`
- Frontend write entrypoint: `BusFlowApi.saveRouteWithStops(...)`
- Concurrency guard: optimistic lock via `updated_at`

## Legacy Scripts
- Deprecated SQL helpers are archived in `sql/legacy/`.
- Do not execute archived scripts in production.
