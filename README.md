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
   - `VITE_PLATFORM_OWNER_EMAIL` (email that should see owner-only settings)
   - `VITE_PASSWORD_RESET_REDIRECT_URL` (optional, fallback is `<origin>/auth/accept-invite`)
   - See `.env.example` for environment separation guidance.
3. Start dev server:
   `npm run dev`
4. Run quality gate:
   `npm run check`
5. Build production bundle:
   `npm run build`

## Invite Onboarding (Password Setup)
- User onboarding is invite-only.
- Admin creates invitation via `invite-account-user` edge function.
- Invite email must redirect to frontend route: `/auth/accept-invite`.
- On that page, the invited user sets a password, then `claim_my_invitation()` activates membership.

### Required Edge Function Secret
Set these in Supabase Function secrets (not as `VITE_` client env):
- `APP_INVITE_REDIRECT_URL=https://<your-domain>/auth/accept-invite`
- `APP_PASSWORD_RESET_REDIRECT_URL=https://<your-domain>/auth/accept-invite`
- `PLATFORM_OWNER_EMAIL=till-schaefer@outlook.com`

### Full Setup Guide
- See `SUPABASE_EDGE_FUNCTION_SETUP.md` for the complete step-by-step setup:
  - creating functions
  - configuring `supabase/config.toml`
  - setting secrets
  - deploying and smoke testing
- Runtime/governance baseline: `SUPABASE_MANIFEST.md`
- JWT incident debugging: `SUPABASE_JWT_FORENSIC_CHECKLIST.md`

## Admin Areas
- `Adminbereich` (`/adminbereich`) is visible for admins and is the place for team invite/role/delete actions.
- `Owner Bereich` (`/owner-bereich`) is visible only for the configured owner email (`VITE_PLATFORM_OWNER_EMAIL`).
- Legacy paths (`/owner-settings`, `/company-settings`, `/platform-admin`, `/team-admin`, `/admin`) are redirected to the correct new area.

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
- `supabase_migration_phase19_rls_audit.sql`: launch security audit warnings for RLS/policies/triggers/linking
- `supabase_migration_phase20_strict_customer_fk.sql`: strict relational enforcement (`customer_id` required on routes)
- `supabase_migration_phase20b_rpc_strict_customer.sql`: canonical strict RPC (`customerId` required; no free-text writes)
- `supabase_migration_phase21_customer_name_drop.sql`: post-pilot cleanup (drop legacy `customer_name`)
- `supabase_migration_phase22_tenant_foundation.sql`: tenant core tables (`platform_accounts`, memberships, admin audit) + helper functions
- `supabase_migration_phase23_account_columns_backfill.sql`: `account_id` rollout/backfill across all BusFlow tables
- `supabase_migration_phase24_tenant_rls_enforcement.sql`: strict account-based RLS + integrity + admin audit triggers
- `supabase_migration_phase25_account_constraints.sql`: `account_id` NOT NULL + tenant uniqueness constraints
- `supabase_migration_phase26_rpc_account_scope.sql`: account-scoped canonical route/stops RPC
- `supabase_migration_phase28_legacy_cleanup_prep.sql`: non-destructive prep marker before app_permissions deprecation

## Canonical Backend Write Path
- Routes + stops are saved through RPC: `save_busflow_route_with_stops`
- Frontend write entrypoint: `BusFlowApi.saveRouteWithStops(...)`
- Concurrency guard: optimistic lock via `updated_at`
- Launch mode requires relational company linkage (`customerId` mandatory)

## Launch Operations
- Launch Phase 1 checklist: `LAUNCH_PHASE1_CHECKLIST.md`
- Pilot recommendation: invite-only initial customer rollout with manual role assignment.
- Multi-tenant rollout starts with `pilot-account` default backfill and can be expanded safely afterwards.

## Legacy Scripts
- Deprecated SQL helpers are archived in `sql/legacy/`.
- Do not execute archived scripts in production.
