# Final Cleanup Report (Current Execution Batch)

This report summarizes the cleanup work completed in this autonomous execution batch.

## What was removed

- `src/apps/busflow/components/PassengerChart.tsx`
  - Reason: verified unused (no imports, no route usage, no dynamic import usage).
- `recharts` dependency
  - Reason: only consumed by removed `PassengerChart.tsx`.

## What was refactored

### BusFlow API split (no external behavior change)

The previous monolithic `src/apps/busflow/api.ts` was split into domain modules:

- `src/apps/busflow/api/shared.ts`
- `src/apps/busflow/api/routes.api.ts`
- `src/apps/busflow/api/settings.api.ts`
- `src/apps/busflow/api/customers.api.ts`
- `src/apps/busflow/api/contacts.api.ts`
- `src/apps/busflow/api/import.api.ts`
- `src/apps/busflow/api/index.ts`

Compatibility facade retained:

- `src/apps/busflow/api.ts` now re-exports `BusFlowApi` from `./api/index`.

## Supabase cleanup artifacts added

- `supabase_migration_phase33_cleanup_audit.sql` (read-only warnings)
- `supabase_migration_phase34_cleanup_drop_unused.sql` (verified legacy drop)
- `supabase_migration_phase35_cleanup_constraints_indexes.sql` (non-breaking index hardening)

## Documentation / Evidence deliverables added

- `CLEANUP_EVIDENCE.md`
- `SUPABASE_USAGE_MATRIX.md`
- `DEPENDENCY_AUDIT.md`

## Explicitly kept (with reason)

- `src/vite-env.d.ts`: compiler support file, expected to have no runtime import references.
- `sql/legacy/fix_rls.sql`: explicitly documented as archived legacy helper in repo docs.
- `app_permissions` DB path: still used by onboarding compatibility trigger (`handle_new_user`).

## Validation

Executed after changes:

- `npm run test` -> PASS
- `npm run check` -> PASS

## Residual risks / open items

1. BusFlow App and Settings components are still large (`BusflowApp.tsx`, `Settings.tsx`, `RouteEditor.tsx`) and should be split in additional safe batches.
2. SQL migration history still contains multiple redefinitions by design; canonical ownership is now documented, but historical consolidation remains ongoing.
3. Bundle size warning persists (>500 kB chunk) and needs targeted code-splitting work (report-only for now).

