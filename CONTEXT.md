# BusFlow Context

## Overview
BusFlow is a role-based route planning app running on Supabase.
It supports route management, stop planning, customer linking, settings data, and print/export.

## Runtime Architecture
- SPA: React + Vite + TypeScript
- Auth: Supabase Auth (email/password)
- Data: Supabase Postgres tables with RLS
- Live refresh: Supabase Realtime subscriptions (`busflow_routes`, `busflow_stops`, settings tables)
- Invite onboarding: edge-function invite email -> `/auth/accept-invite` -> password set -> `claim_my_invitation()`

## Engineering Policy
- SQL is migration-first (`supabase_migration_*.sql` is operational truth)
- `supabase_schema.sql` is legacy baseline reference only
- Local pre-merge gate: `npm run check`
- Shared database is tenant-scoped via `platform_accounts` + `account_memberships`.

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
- `platform_accounts`: tenant/account master table
- `account_memberships`: user-to-account membership + per-account role
- `admin_access_audit`: audit trail for platform-admin cross-tenant access

## Role Model
- Platform admin: `profiles.global_role = 'ADMIN'`
- BusFlow app role: `app_permissions` for `app_id='busflow'`
- Effective frontend role:
  - global `ADMIN` => `ADMIN`
  - else `app_permissions.role` => `DISPATCH`/`VIEWER`

## Invite Acceptance Flow
- `invite-account-user` requires `APP_INVITE_REDIRECT_URL` and sends invite links to `/auth/accept-invite`.
- `platform-send-password-reset` requires `APP_PASSWORD_RESET_REDIRECT_URL` for reset-link delivery.
- `handle_new_user()` creates `INVITED` membership and keeps invitation `PENDING`.
- `claim_my_invitation()` is called after password setup and marks invitation `ACCEPTED` + membership `ACTIVE`.

## Canonical Save Flow
- Frontend calls `BusFlowApi.saveRouteWithStops(route, expectedUpdatedAt)`
- Backend RPC `save_busflow_route_with_stops` updates route + replaces stops atomically
- RPC returns conflict code when `updated_at` differs

## Customer Linking Model
- Launch strict relational mode:
  - `busflow_routes.customer_id` is required (company link mandatory)
  - `busflow_routes.customer_contact_id` stays optional
  - legacy `customer_name` is compatibility-only and planned for removal in phase21
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
20. `supabase_migration_phase19_rls_audit.sql`
21. `supabase_migration_phase20_strict_customer_fk.sql`
22. `supabase_migration_phase20b_rpc_strict_customer.sql`
23. `supabase_migration_phase21_customer_name_drop.sql` (post-pilot cleanup)
24. `supabase_migration_phase22_tenant_foundation.sql`
25. `supabase_migration_phase23_account_columns_backfill.sql`
26. `supabase_migration_phase24_tenant_rls_enforcement.sql`
27. `supabase_migration_phase25_account_constraints.sql`
28. `supabase_migration_phase26_rpc_account_scope.sql`
29. `supabase_migration_phase28_legacy_cleanup_prep.sql`

## Notes
- Deprecated helper scripts are under `sql/legacy/` and must not be run in production.
- Route/company hard enforcement is active in launch mode (`customer_id NOT NULL` via phase20).
