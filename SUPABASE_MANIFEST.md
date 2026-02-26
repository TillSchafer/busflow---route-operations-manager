# Supabase Manifest (Source of Truth)

Last verified: `2026-02-26 11:39:07 UTC`
Project ref: `jgydzxdiwpldgrqkfbfk`

## Policy
- Keep all Supabase artifacts in Git.
- Do not delete migration or function files after deploy.
- Runtime DB changes must come from migration files only.
- Canonical migration path is `supabase/migrations/`.
- `docs/migrations/` is archive/reference only.
- Edge function config stays in `supabase/config.toml` and follows current incident policy.

## Local Artifacts (must exist in repo)
- `supabase/config.toml`
- `supabase/functions/invite-account-user/index.ts`
- `supabase/functions/platform-provision-account/index.ts`
- `supabase/functions/platform-send-password-reset/index.ts`
- `supabase/functions/admin-delete-user-v3/index.ts`
- `supabase/functions/admin-manage-invitation-v1/index.ts`
- `supabase/functions/admin-update-membership-role-v1/index.ts`
- `supabase/functions/admin-update-user-v1/index.ts`
- `supabase/functions/owner-update-account-v1/index.ts`
- `supabase/functions/owner-company-overview-v1/index.ts`
- `supabase/functions/platform-delete-account/index.ts`
- `supabase/functions/public-register-trial-v1/index.ts`
- `supabase/functions/self-profile-security-v1/index.ts`
- `supabase/migrations/*.sql` (canonical, CLI-driven)
- `docs/migrations/*.sql` (legacy archive)

## Deployed Edge Functions (verified via CLI)
- `invite-account-user` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `platform-provision-account` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `platform-send-password-reset` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `admin-delete-user-v3` (target canonical delete endpoint, `verify_jwt=false`, temporary fallback)
- `admin-manage-invitation-v1` (ACTIVE, `verify_jwt=false`)
- `admin-update-membership-role-v1` (ACTIVE; currently `verify_jwt=true` in remote metadata, local config expects `false`)
- `admin-update-user-v1` (ACTIVE, `verify_jwt=false`, legacy candidate)
- `owner-update-account-v1` (ACTIVE, `verify_jwt=false`)
- `owner-company-overview-v1` (ACTIVE, `verify_jwt=false`)
- `platform-delete-account` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `public-register-trial-v1` (ACTIVE, `verify_jwt=false`)
- `self-profile-security-v1` (ACTIVE, `verify_jwt=false`)

## Required Secrets (verified present in project)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_INVITE_REDIRECT_URL`
- `APP_PASSWORD_RESET_REDIRECT_URL`
- `APP_ACCOUNT_SECURITY_REDIRECT_URL`
- `PLATFORM_OWNER_EMAIL`
- `SELF_SIGNUP_IP_HASH_SALT`

## Optional Secrets / Reserved
- `SELF_SIGNUP_ENABLED` (optional feature flag; currently not set remotely, defaults to enabled in code)
- `SUPABASE_DB_URL` (currently present remotely but not referenced in deployed function code)

## Runtime Usage Snapshot (frontend)
- Active callers: `invite-account-user`, `admin-update-membership-role-v1`, `admin-manage-invitation-v1`, `admin-delete-user-v3`, `owner-company-overview-v1`, `owner-update-account-v1`, `platform-provision-account`, `platform-delete-account`, `public-register-trial-v1`, `self-profile-security-v1`.
- Decommission candidates (no active runtime caller): `admin-update-user-v1`, `platform-send-password-reset`.

## Runtime Guardrails
- Temporary incident mitigation: selected admin functions run with `verify_jwt=false` while enforcing strict bearer token validation and role checks in function code.
- Re-enable `verify_jwt=true` function-by-function after Supabase support confirms gateway behavior is fixed.
- Do not use direct client deletes on `profiles` / `platform_accounts`.
- Use edge functions for privileged mutations with audit logging.

## Audit Artifacts
- `docs/supabase/supabase-function-secret-audit-2026-02-26.md`
- `docs/supabase/smoke-functions-2026-02-26.json`
- `scripts/supabase/smoke-functions.mjs`
- `scripts/supabase/e2e-functions-auth-matrix.mjs`
