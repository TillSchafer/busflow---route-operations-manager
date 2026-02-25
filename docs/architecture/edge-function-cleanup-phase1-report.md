# Edge Function Cleanup + DB Audit Report (Phase 1)

Date: 2026-02-24
Project ref: `jgydzxdiwpldgrqkfbfk`

## Scope executed
- Conservative legacy cleanup only.
- Read-only DB audit via CLI inspect commands.
- Migration-process switch scaffold to `supabase/migrations`.

## Remote deletions performed
Commands executed:
```bash
npx supabase functions delete admin-delete-user --project-ref jgydzxdiwpldgrqkfbfk --yes
npx supabase functions delete admin-delete-user-v2 --project-ref jgydzxdiwpldgrqkfbfk --yes
npx supabase functions delete smart-function --project-ref jgydzxdiwpldgrqkfbfk --yes
```

Verification:
- `npx supabase functions list --project-ref jgydzxdiwpldgrqkfbfk`
- Result: all three slugs no longer present.

## Functions intentionally kept
- `admin-update-user-v1`
- `platform-send-password-reset`

Reason:
- Conservative scope for phase 1.
- Both are candidates for phase 2 cleanup after external usage verification.

## DB audit status
- Completed:
  - `inspect db table-stats`
  - `inspect db index-stats`
  - `inspect db db-stats`
- Blocked in CLI by tooling issue:
  - `inspect db role-stats`

Blocking detail:
- Re-run with provided `SUPABASE_DB_PASSWORD` resolved auth/circuit-breaker errors.
- `role-stats` still fails with CLI scan bug:
  - `can't scan into dest[3]: cannot scan null into *string`
- SQL fallback added:
  - `docs/migrations/supabase_phase43_readonly_role_stats_fallback.sql`

## Migration workflow switch
Implemented scaffolding:
- Added canonical migration path:
  - `supabase/migrations/`
  - `supabase/migrations/20260224190000__migration_workflow_bootstrap.sql`
  - `supabase/migrations/README.md`
- Marked legacy archive path:
  - `docs/migrations/README.md`
- Updated governance docs (`README.md`, `SUPABASE_MANIFEST.md`) to point to `supabase/migrations` as canonical.

## Notable finding
- Remote metadata shows `admin-update-membership-role-v1` currently with `verify_jwt=true`,
  while local `supabase/config.toml` sets `verify_jwt=false`.
- Action recommendation:
  - Decide target policy and redeploy explicitly with/without `--no-verify-jwt` to align runtime and config.

## Regression checks
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
