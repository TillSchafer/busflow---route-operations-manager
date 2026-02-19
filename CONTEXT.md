# BusFlow Context

## Overview
BusFlow is a role-based route planning app running on Supabase.
It supports route management, stop planning, customer linking, settings data, and print/export.

## Runtime Architecture
- SPA: React + Vite + TypeScript
- Auth: Supabase Auth (email/password)
- Data: Supabase Postgres tables with RLS
- Live refresh: Supabase Realtime subscriptions (`busflow_routes`, `busflow_stops`, settings tables)

## Core Backend Entities
- `profiles`: platform user profile + `global_role`
- `app_permissions`: per-app role (`busflow`: `ADMIN`/`DISPATCH`/`VIEWER`)
- `busflow_routes`: route header (includes `customer_id`, legacy `customer_name`, `updated_at`)
- `busflow_stops`: ordered stops with passenger and geo fields
- `busflow_bus_types`: vehicle templates/capacity
- `busflow_workers`: driver/team master data
- `busflow_customers`: global customer master data
- `busflow_app_settings`: global app settings (e.g. default map center/zoom)

## Role Model
- Platform admin: `profiles.global_role = 'ADMIN'`
- BusFlow app role: `app_permissions` for `app_id='busflow'`
- Effective frontend role:
  - global `ADMIN` => `ADMIN`
  - else `app_permissions.role` => `DISPATCH`/`VIEWER`

## Canonical Save Flow
- Frontend calls `BusFlowApi.saveRouteWithStops(route, expectedUpdatedAt)`
- Backend RPC `save_busflow_route_with_stops` updates route + replaces stops atomically
- RPC returns conflict code when `updated_at` differs

## Customer Linking Model
- Hybrid model: routes support free-text customer labels plus optional FK link
- `busflow_routes.customer_name` stores what user entered (display priority)
- `busflow_routes.customer_id -> busflow_customers.id` remains optional for list linking
- Customer list is a convenience picker, not a hard requirement

## Current Migration Order
1. `supabase_schema.sql`
2. `supabase_migration_workers.sql`
3. `supabase_migration_phase3.sql`
4. `supabase_migration_phase4.sql`
5. `supabase_migration_phase5.sql`
6. `supabase_migration_phase6.sql`
7. `supabase_migration_phase7_roles.sql`
8. `supabase_migration_phase8_customers.sql`
9. `supabase_migration_phase9_concurrency.sql`
10. `supabase_migration_phase10_customer_fk.sql`
11. `supabase_migration_phase11_customer_name_cleanup.sql` (deprecated for hybrid mode)
12. `supabase_migration_phase12_backend_cleanup.sql`
13. `supabase_migration_phase13_map_default_settings.sql`
14. `supabase_migration_phase14_customer_hybrid_restore.sql`
15. `supabase_migration_phase14b_customer_hybrid_rpc.sql`

## Notes
- Deprecated helper scripts are under `sql/legacy/` and must not be run in production.
- Route/customer hard enforcement (`customer_id NOT NULL`) is intentionally deferred.
