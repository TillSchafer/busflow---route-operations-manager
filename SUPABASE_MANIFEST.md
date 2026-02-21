# Supabase Manifest (Source of Truth)

Last verified: `2026-02-21 12:58:00 UTC`
Project ref: `jgydzxdiwpldgrqkfbfk`

## Policy
- Keep all Supabase artifacts in Git.
- Do not delete migration or function files after deploy.
- Runtime DB changes must come from migration files only.
- Edge function config stays in `supabase/config.toml` and follows current incident policy.

## Local Artifacts (must exist in repo)
- `supabase/config.toml`
- `supabase/functions/invite-account-user/index.ts`
- `supabase/functions/platform-provision-account/index.ts`
- `supabase/functions/platform-send-password-reset/index.ts`
- `supabase/functions/admin-delete-user/index.ts`
- `supabase/functions/admin-delete-user-v2/index.ts`
- `supabase/functions/admin-delete-user-v3/index.ts`
- `supabase/functions/platform-delete-account/index.ts`
- `supabase_migration_phase*.sql` files (migration-first schema history)

## Deployed Edge Functions (verified via CLI)
- `invite-account-user` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `platform-provision-account` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `platform-send-password-reset` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `admin-delete-user` (ACTIVE, `verify_jwt=true`, legacy hold for rollback)
- `admin-delete-user-v2` (ACTIVE, `verify_jwt=true`, rollback candidate)
- `admin-delete-user-v3` (target canonical delete endpoint, `verify_jwt=false`, temporary fallback)
- `platform-delete-account` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `smart-function` (ACTIVE, not represented in local repo; see cleanup candidate below)

## Required Secrets (verified present in project)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_INVITE_REDIRECT_URL`
- `APP_PASSWORD_RESET_REDIRECT_URL`

## Cleanup Candidates (HOLD until evidence complete)
- `smart-function`
  - Status: deployed remotely, no local source file in this repo.
  - Current evidence: no reference found in `src/` and docs.
  - Required before delete:
    1. Confirm no external client/system calls this function.
    2. Confirm no scheduled task or webhook depends on it.
    3. Remove only via controlled change + rollback note.

## Runtime Guardrails
- Temporary incident mitigation: selected admin functions run with `verify_jwt=false` while enforcing strict bearer token validation and role checks in function code.
- Re-enable `verify_jwt=true` function-by-function after Supabase support confirms gateway behavior is fixed.
- Do not use direct client deletes on `profiles` / `platform_accounts`.
- Use edge functions for privileged mutations with audit logging.
