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
6. Quality gate + tooling baseline
   - Added `npm run typecheck`, `npm run lint`, `npm run check`
   - Added ESLint flat config (`eslint.config.js`)
   - Added Vite env typing baseline (`src/vite-env.d.ts`, `tsconfig.json` types update)
   - Fixed toast timer typing issue in `src/shared/components/ToastProvider.tsx`
7. SQL governance and drift control
   - Added `supabase_migration_phase18_sql_governance.sql`
   - Annotates canonical owner migrations for critical functions
   - Adds idempotent sanity checks for trigger/policy/index presence
8. Migration policy hardening
   - Marked `supabase_schema.sql` as legacy/non-authoritative baseline
   - Migration-first workflow documented in `README.md` and `CONTEXT.md`
9. API cleanup increment
   - Reduced `any` in `src/apps/busflow/api.ts` and `src/apps/busflow/BusflowApp.tsx`
   - Standardized error-code mapping helpers (`ROUTE_CONFLICT`, `CONTACT_IN_USE`, `CUSTOMER_IN_USE`)

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
- [ ] Phase18 runs successfully and only emits warnings when objects are missing
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run check` passes
- [ ] New signup creates `profiles` + `app_permissions(busflow=DISPATCH)`
- [ ] Route save conflict logic still works (`ROUTE_CONFLICT`)
- [ ] Customer/contact-linked route save/read still works
