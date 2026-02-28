# Supabase Manifest (Source of Truth)

Last verified: `2026-02-28 UTC`
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
- `admin-delete-user-v3` (ACTIVE, canonical delete endpoint, `verify_jwt=false`, temporary fallback)
- `admin-manage-invitation-v1` (ACTIVE, `verify_jwt=false`)
- `admin-update-membership-role-v1` (ACTIVE, `verify_jwt=true`, config.toml synced 2026-02-28)
- `owner-update-account-v1` (ACTIVE, `verify_jwt=false`)
- `owner-company-overview-v1` (ACTIVE, `verify_jwt=false`)
- `platform-delete-account` (ACTIVE, `verify_jwt=false`, temporary fallback)
- `public-register-trial-v1` (ACTIVE, `verify_jwt=false`)
- `self-profile-security-v1` (ACTIVE, `verify_jwt=false`)

## Decommission Candidates
Functions deployed remotely but with no active frontend caller. Keep deployed until explicit removal decision.
Do NOT add new callers without a documented use case.

- `admin-update-user-v1` — no frontend caller since initial deployment; superseded by role-scoped functions
- `platform-send-password-reset` — API wrapper exists in `support.api.ts` but no active UI trigger; support flow not yet built

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

## CORS Policy Decision
- All functions use `Access-Control-Allow-Origin: *` (wildcard), defined centrally in `_shared/utils.ts`.
- Authenticated functions: wildcard is safe — Bearer tokens are explicit, not cookie-based.
- `public-register-trial-v1`: wildcard accepted because the endpoint is intentionally public. Rate limiting (IP + email) and honeypot field provide abuse protection. Restricting origin would not prevent curl/API abuse. Revisit if abuse patterns emerge.

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
