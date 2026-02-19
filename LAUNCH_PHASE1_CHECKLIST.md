# Launch Phase 1 Checklist (Supabase Hardening + Strict Relational)

## 1) Environment Separation
- [ ] Create separate Supabase projects for `dev` and `prod`.
- [ ] Configure production secrets in hosting provider (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- [ ] Rotate old/exposed test keys before pilot go-live.

## 2) Database Migrations (in order)
- [ ] Apply `supabase_migration_phase19_rls_audit.sql` and review warnings.
- [ ] Apply `supabase_migration_phase20_strict_customer_fk.sql`.
- [ ] Apply `supabase_migration_phase20b_rpc_strict_customer.sql`.
- [ ] Apply `supabase_migration_phase22_tenant_foundation.sql`.
- [ ] Apply `supabase_migration_phase23_account_columns_backfill.sql`.
- [ ] Apply `supabase_migration_phase24_tenant_rls_enforcement.sql`.
- [ ] Apply `supabase_migration_phase25_account_constraints.sql`.
- [ ] Apply `supabase_migration_phase26_rpc_account_scope.sql`.
- [ ] Keep `supabase_migration_phase21_customer_name_drop.sql` for post-pilot only.

## 3) Security & RLS Validation
- [ ] Verify `VIEWER` cannot mutate busflow tables.
- [ ] Verify `DISPATCH` and `ADMIN` can mutate expected busflow scope.
- [ ] Verify non-admin cannot mutate global admin role/permissions tables.
- [ ] Verify signup trigger creates `profiles` + `app_permissions(busflow=DISPATCH)`.

## 4) Functional Smoke Tests
- [ ] Create route without company -> blocked in UI / rejected by backend.
- [ ] Create route with company only -> success.
- [ ] Create route with company + contact -> success.
- [ ] Delete contact linked to route -> blocked (`CONTACT_IN_USE`).
- [ ] Concurrency conflict still handled (`ROUTE_CONFLICT`).

## 5) Build & Quality Gate
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run check`

## 6) Pilot Operations
- [ ] Invite-only pilot onboarding.
- [ ] Manual role assignment in Admin.
- [ ] Monitor save/import/delete errors daily.
- [ ] Define forward-fix rollback procedure for failed migrations.

## 7) Post-Pilot Cleanup
- [ ] Confirm no code path reads/writes `customer_name`.
- [ ] Apply `supabase_migration_phase21_customer_name_drop.sql`.
- [ ] Remove remaining legacy compatibility comments/docs.
