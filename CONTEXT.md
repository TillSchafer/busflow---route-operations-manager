# BusFlow Context

## Overview
BusFlow is a role-based route planning app running on Supabase.
It supports route management, stop planning, customer linking, settings data, and print/export.

## Runtime Architecture
- SPA: React + Vite + TypeScript
- Auth: Supabase Auth (email/password)
- Data: Supabase Postgres tables with RLS
- Live refresh: Supabase Realtime subscriptions (`busflow_routes`, `busflow_stops`, settings tables)

## Engineering Policy
- SQL is migration-first (`supabase_migration_*.sql` is operational truth)
- `supabase_schema.sql` is legacy baseline reference only
- Local pre-merge gate: `npm run check`

## Core Backend Entities
- `profiles`: platform user profile + `global_role`
- `app_permissions`: per-app role (`busflow`: `ADMIN`/`DISPATCH`/`VIEWER`)
- `busflow_routes`: route header (includes `customer_id`, legacy `customer_name`, `updated_at`)
- `busflow_stops`: ordered stops with passenger and geo fields
- `busflow_bus_types`: vehicle templates/capacity
- `busflow_workers`: driver/team master data
- `busflow_customers`: global customer master data
- `busflow_customer_contacts`: multi-contact table per company/customer
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
- Hybrid route label model remains active:
  - `busflow_routes.customer_name` stores entered free text for display
  - `busflow_routes.customer_id` optionally links to company (`busflow_customers`)
  - `busflow_routes.customer_contact_id` optionally links to contact (`busflow_customer_contacts`)
- Settings list and import flows are contact-centric (company + contact pairs).

## Current Migration Order
1. `supabase_migration_workers.sql`
2. `supabase_migration_phase3.sql`
3. `supabase_migration_phase4.sql`
4. `supabase_migration_phase5.sql`
5. `supabase_migration_phase6.sql`
6. `supabase_migration_phase7_roles.sql`
7. `supabase_migration_phase8_customers.sql`
8. `supabase_migration_phase9_concurrency.sql`
9. `supabase_migration_phase10_customer_fk.sql`
10. `supabase_migration_phase11_customer_name_cleanup.sql` (deprecated for hybrid mode)
11. `supabase_migration_phase12_backend_cleanup.sql`
12. `supabase_migration_phase13_map_default_settings.sql`
13. `supabase_migration_phase14_customer_hybrid_restore.sql`
14. `supabase_migration_phase14b_customer_hybrid_rpc.sql`
15. `supabase_migration_phase15_customer_import_fields.sql`
16. `supabase_migration_phase16_customer_search_indexes.sql`
17. `supabase_migration_phase17_customer_contacts.sql`
18. `supabase_migration_phase17b_customer_contacts_rpc.sql`
19. `supabase_migration_phase18_sql_governance.sql`

## Notes
- Deprecated helper scripts are under `sql/legacy/` and must not be run in production.
- Route/customer hard enforcement (`customer_id NOT NULL`) is intentionally deferred.
