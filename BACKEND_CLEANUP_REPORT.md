# Backend Cleanup Report

## Scope
Safe incremental cleanup with no destructive schema rewrites.

## Delivered
1. Added `supabase_migration_phase12_backend_cleanup.sql`
   - Canonical `handle_new_user()` with idempotent inserts
   - Canonical `on_auth_user_created` trigger recreation
   - Canonical FK-aware `save_busflow_route_with_stops(...)`
   - Index guard: `idx_busflow_routes_customer_id`
   - Non-blocking policy presence checks (`raise warning`)
2. Archived risky legacy SQL script
   - `fix_rls.sql` moved to `sql/legacy/fix_rls.sql`
   - Added deprecation header and replacement references
3. Cleaned API write surface
   - Removed unused `BusFlowApi.updateRoute`
   - Removed unused `BusFlowApi.updateStops`
   - `saveRouteWithStops` remains canonical write path
4. Caller cleanup
   - Removed `as any` in route creation path in `src/apps/busflow/BusflowApp.tsx`
5. Docs updated
   - `README.md` rewritten to current stack and migration map
   - `CONTEXT.md` rewritten to current Supabase architecture

## Compatibility Status
- `customer_name` compatibility remains active for one release cycle.
- No external API changes.
- No immediate forced `customer_id NOT NULL`.

## Rollout Steps
1. Apply `supabase_migration_phase12_backend_cleanup.sql`.
2. Deploy frontend with API cleanup.
3. Validate role/signup/save workflows.
4. Later: run `supabase_migration_phase11_customer_name_cleanup.sql` after confirming stable FK-only usage.

## Validation Checklist
- [ ] Phase12 runs successfully on existing DB
- [ ] Re-running Phase12 is idempotent
- [ ] New signup creates `profiles` + `app_permissions(busflow=DISPATCH)`
- [ ] Route save conflict logic still works (`ROUTE_CONFLICT`)
- [ ] Customer-linked route save/read still works
- [ ] Build passes (`npm run build`)
