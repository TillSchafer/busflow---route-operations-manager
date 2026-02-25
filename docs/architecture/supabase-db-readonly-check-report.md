# Supabase DB Read-only Check Report

Date: 2026-02-24
Project ref: `jgydzxdiwpldgrqkfbfk`
Mode: CLI-first, read-only

## Precondition Status
- `SUPABASE_DB_PASSWORD`: available for the re-run session (passed via inline env var).
- Result: auth/circuit-breaker issue resolved.

## CLI Checks Executed

### 1) `inspect db table-stats`
Status: **success**

High-signal values:
- `profiles`: estimated ~4 rows, very high seq scans (~62972)
- `busflow_customer_contacts`: ~687 rows
- `busflow_customers`: ~272 rows
- `platform_accounts`: ~1 row
- `app_permissions`: ~4 rows (legacy data still present)

### 2) `inspect db index-stats --linked`
Status: **success**

Findings:
- Several unused indexes (0 index scans), e.g.:
  - `idx_platform_accounts_status`
  - `idx_platform_accounts_created_at`
  - `idx_busflow_routes_account_id`
  - `idx_busflow_routes_customer_id`
  - `idx_busflow_routes_customer_contact_id`
  - `idx_account_invitations_email`
- Important active indexes are used (e.g. PKs, membership uniqueness, invitation pending uniqueness).

### 3) `inspect db db-stats --linked`
Status: **success**

Key metrics:
- DB size: ~14 MB
- Index hit rate: 1.00
- Table hit rate: 1.00
- WAL size: ~160 MB

### 4) `inspect db role-stats --linked`
Status: **failed due CLI scan bug**, not auth
- Error:
  - `failed to scan targets: can't scan into dest[3]: cannot scan null into *string`
  - confirmed with `--debug` output (NULL role configs in `pg_roles.rolconfig`)

### 5) SQL-Editor fallback for role stats
Status: **prepared**
- Fallback query added:
  - `docs/migrations/supabase_phase43_readonly_role_stats_fallback.sql`
- Also embedded in:
  - `docs/migrations/supabase_phase43_readonly_architecture_checks.sql` (section 0)

## Severity Assessment

### High
- None from CLI inspect results.

### Medium
- Potential index bloat/maintenance debt from multiple unused indexes.
- `profiles` high seq-scan count should be monitored (possibly expected due auth/profile lookups, but worth confirming query patterns).
- Supabase CLI `role-stats` command currently unreliable for this project due NULL scan bug (tooling risk for ops visibility).

### Low
- Legacy `app_permissions` data still present (expected in transitional deprecation strategy).

## Required Follow-up to complete full check set
1. Execute SQL read-only check scripts in Supabase SQL Editor and archive outputs:
- `docs/migrations/supabase_phase42b_readonly_invite_checks.sql`
- `docs/migrations/supabase_phase43_readonly_architecture_checks.sql`
- `docs/migrations/supabase_phase43_readonly_role_stats_fallback.sql`

2. Keep CLI checks in runbook with known limitation note:
```bash
SUPABASE_DB_PASSWORD='<db_password>' npx supabase inspect db table-stats --linked
SUPABASE_DB_PASSWORD='<db_password>' npx supabase inspect db index-stats --linked
SUPABASE_DB_PASSWORD='<db_password>' npx supabase inspect db db-stats --linked
```
`role-stats` should be executed via SQL fallback until CLI fixes NULL scan handling.
