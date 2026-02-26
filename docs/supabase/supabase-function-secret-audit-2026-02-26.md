# Supabase Function + Secret Audit

Audit date (UTC): `2026-02-26 11:39:07`  
Project ref: `jgydzxdiwpldgrqkfbfk`  
Project name: `Schäfer Intranet`  
Environment audited: remote project (production-linked), read-only plus boundary HTTP checks

## 1) Scope

This audit verifies:

- Full inventory of deployed Edge Functions vs repo config.
- Full inventory of remote secrets vs actually referenced `Deno.env.get(...)` keys.
- Runtime usage mapping from frontend code to function slugs.
- Security drift (`verify_jwt`) between local config and remote metadata.
- Boundary smoke tests (`OPTIONS`, `POST` no auth, `POST` anon bearer).
- Staging E2E matrix preparation script for role-based success/forbidden checks.

## 2) Evidence Snapshot

Commands executed:

- `npx supabase functions list --project-ref jgydzxdiwpldgrqkfbfk --output json`
- `npx supabase secrets list --project-ref jgydzxdiwpldgrqkfbfk --output json`
- `npx supabase migration list --linked`
- `node scripts/supabase/smoke-functions.mjs --out docs/supabase/smoke-functions-2026-02-26.json`
- `node scripts/supabase/e2e-functions-auth-matrix.mjs --out docs/supabase/e2e-functions-auth-matrix-template-output.json`
- `rg` inventory scans across `src/` and `supabase/functions/`

Artifacts:

- [smoke-functions-2026-02-26.json](/Users/tillschafer/Downloads/busflow---route-operations-manager/docs/supabase/smoke-functions-2026-02-26.json)
- [e2e-functions-auth-matrix-template-output.json](/Users/tillschafer/Downloads/busflow---route-operations-manager/docs/supabase/e2e-functions-auth-matrix-template-output.json)
- [smoke-functions.mjs](/Users/tillschafer/Downloads/busflow---route-operations-manager/scripts/supabase/smoke-functions.mjs)
- [e2e-functions-auth-matrix.mjs](/Users/tillschafer/Downloads/busflow---route-operations-manager/scripts/supabase/e2e-functions-auth-matrix.mjs)

## 3) Function Inventory (Remote vs Local)

Result: local and remote slugs are **1:1 aligned** (12/12).

| Function | Remote status | Remote version | Remote verify_jwt | Local verify_jwt (`config.toml`) | Drift | Runtime caller |
|---|---:|---:|---:|---:|---:|---|
| `admin-delete-user-v3` | ACTIVE | 10 | false | false | no | `src/shared/api/admin/teamAdmin.api.ts` |
| `admin-manage-invitation-v1` | ACTIVE | 7 | false | false | no | `src/shared/api/admin/teamAdmin.api.ts` |
| `admin-update-membership-role-v1` | ACTIVE | 5 | true | false | **yes** | `src/shared/api/admin/teamAdmin.api.ts` |
| `admin-update-user-v1` | ACTIVE | 8 | false | false | no | no runtime caller in `src/` |
| `invite-account-user` | ACTIVE | 19 | false | false | no | `src/shared/api/admin/teamAdmin.api.ts` |
| `owner-company-overview-v1` | ACTIVE | 9 | false | false | no | `src/shared/api/admin/platformAdmin.api.ts` |
| `owner-update-account-v1` | ACTIVE | 9 | false | false | no | `src/shared/api/admin/platformAdmin.api.ts` |
| `platform-delete-account` | ACTIVE | 13 | false | false | no | `src/shared/api/admin/platformAdmin.api.ts` |
| `platform-provision-account` | ACTIVE | 16 | false | false | no | `src/shared/api/admin/platformAdmin.api.ts` |
| `platform-send-password-reset` | ACTIVE | 17 | false | false | no | API wrapper exists (`support.api.ts`), no current UI caller |
| `public-register-trial-v1` | ACTIVE | 6 | false | false | no | `src/shared/api/public/registerTrial.api.ts` |
| `self-profile-security-v1` | ACTIVE | 2 | false | false | no | `src/shared/api/profile/profileSecurity.api.ts` |

## 4) Usage Matrix (Code -> Function)

Active runtime usage in current app flows:

- `invite-account-user`
- `admin-update-membership-role-v1`
- `admin-manage-invitation-v1`
- `admin-delete-user-v3`
- `owner-company-overview-v1`
- `owner-update-account-v1`
- `platform-provision-account`
- `platform-delete-account`
- `public-register-trial-v1`
- `self-profile-security-v1`

Present but currently unused in active UI flow:

- `admin-update-user-v1`
- `platform-send-password-reset`

## 5) Secret Inventory and Coverage

Secrets present remotely (9):

- `APP_ACCOUNT_SECURITY_REDIRECT_URL`
- `APP_INVITE_REDIRECT_URL`
- `APP_PASSWORD_RESET_REDIRECT_URL`
- `PLATFORM_OWNER_EMAIL`
- `SELF_SIGNUP_IP_HASH_SALT`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Secrets referenced in function code (`Deno.env.get`) (9):

- `APP_ACCOUNT_SECURITY_REDIRECT_URL`
- `APP_INVITE_REDIRECT_URL`
- `APP_PASSWORD_RESET_REDIRECT_URL`
- `PLATFORM_OWNER_EMAIL`
- `SELF_SIGNUP_ENABLED`
- `SELF_SIGNUP_IP_HASH_SALT`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Diff:

- Missing remote (optional in code): `SELF_SIGNUP_ENABLED`  
  Notes: `public-register-trial-v1` defaults to enabled when missing.
- Present remote but unused in current function code: `SUPABASE_DB_URL`  
  Notes: keep as reserved/legacy candidate; do not remove now.

## 6) Boundary Smoke Results (Stage A)

Script: [smoke-functions.mjs](/Users/tillschafer/Downloads/busflow---route-operations-manager/scripts/supabase/smoke-functions.mjs)  
Report: [smoke-functions-2026-02-26.json](/Users/tillschafer/Downloads/busflow---route-operations-manager/docs/supabase/smoke-functions-2026-02-26.json)

Summary:

- All 12 functions: `OPTIONS` => `200` (`ok`) passed.
- Protected functions:
  - `POST` without bearer => `401` passed.
  - `POST` with anon bearer => `401` passed.
- `public-register-trial-v1`:
  - empty/invalid payload => `400 INVALID_INPUT` passed.
- `self-profile-security-v1`:
  - unknown action with anon bearer => `401` (expected auth wall) passed.

Notable contract variance:

- `admin-update-membership-role-v1` no-auth response format differs slightly (`{"code":401,"message":"Missing authorization header"}`) while status is correct.

## 7) Staging Matrix Script (Stage B)

Script: [e2e-functions-auth-matrix.mjs](/Users/tillschafer/Downloads/busflow---route-operations-manager/scripts/supabase/e2e-functions-auth-matrix.mjs)

Purpose:

- Execute role-based success/forbidden matrix in staging/clone with real JWTs.
- Cover owner/platform-admin/account-admin/dispatch/viewer behavior.
- Explicitly test `self-profile-security-v1` actions and `admin-update-membership-role-v1` gateway behavior.

Safety controls:

- Mutation tests are skipped unless `E2E_ALLOW_MUTATIONS=true`.
- Per-test payload override via env JSON variables.
- Missing credentials produce skip records, not false positives.

## 8) Key Findings

1. High priority: `verify_jwt` drift on `admin-update-membership-role-v1`
- Remote: `true`
- Local config: `false`
- Action: decide and enforce one canonical value, then redeploy/document.

2. Medium priority: function lifecycle debt
- `admin-update-user-v1` and `platform-send-password-reset` are deployed but not in active UI flow.
- Action: mark as phase-2 decommission candidates with exit gates.

3. Medium priority: docs drift
- Prior docs missed the newly active `self-profile-security-v1` and `APP_ACCOUNT_SECURITY_REDIRECT_URL`.
- Action: update manifest/setup docs (done in this implementation set).

4. Low priority: optional feature-flag secret not set
- `SELF_SIGNUP_ENABLED` absent remote; behavior defaults to enabled.
- Action: set explicitly if ops wants deterministic off-switch.

5. Constraint: local schema diff tooling blocked
- `supabase db pull` currently blocked due to missing Docker daemon in local environment.
- Action: rerun schema drift checks when Docker is available.

## 9) Hardening and Cleanup Plan

Immediate:

- Resolve `verify_jwt` drift for `admin-update-membership-role-v1`.
- Keep `SUPABASE_DB_URL` and currently unused functions, but tag them as `reserved/cleanup-candidate`.
- Optionally add `SELF_SIGNUP_ENABLED=true` explicitly for deterministic behavior.

Phase 2 (staging-first):

- Run full RBAC success/forbidden matrix with real role users.
- If no runtime callers for 2 releases:
  - decommission `admin-update-user-v1`
  - decommission `platform-send-password-reset`
  - remove `SUPABASE_DB_URL` (if still unused)

## 10) Re-run Commands

```bash
# Inventory
npx supabase functions list --project-ref jgydzxdiwpldgrqkfbfk --output json
npx supabase secrets list --project-ref jgydzxdiwpldgrqkfbfk --output json
npx supabase migration list --linked

# Boundary smoke
node scripts/supabase/smoke-functions.mjs --out docs/supabase/smoke-functions-<date>.json

# Staging role matrix
E2E_ALLOW_MUTATIONS=true node scripts/supabase/e2e-functions-auth-matrix.mjs \
  --out docs/supabase/e2e-functions-auth-matrix-<date>.json
```
