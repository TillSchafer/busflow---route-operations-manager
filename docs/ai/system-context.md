# BusFlow – Complete Technical Context & System Documentation

Date baseline: 2026-02-21
Project ref: `jgydzxdiwpldgrqkfbfk`

Legend:
- `Confirmed`: Verified directly in current repository code/config/migrations.
- `Historical`: Behavior that existed in earlier phases and was changed later.
- `Open`: Known unresolved issue, temporary mitigation, or fragility.

## 1. Project Overview
- `Confirmed` BusFlow is a multi-tenant route operations web app for bus/transport teams, built with React + Vite + TypeScript and Supabase.
- `Confirmed` Main purpose: manage routes, stops, customers/contacts, workers, bus types, settings, and admin operations with tenant isolation.
- `Confirmed` Target users:
- Platform Admin: cross-tenant operations (provision account, support reset, hard-delete user/account).
- Tenant Admin: manage users/invitations inside own account.
- Dispatch: operational write access in account.
- Viewer: read-only account access.
- `Confirmed` Core feature domains:
- Invite-only onboarding with password setup via invite link.
- Account-scoped route lifecycle with optimistic concurrency.
- Company/contact master data and import workflows.
- Platform admin support functions (password reset link, account lifecycle, hard-delete flows).
- Realtime account-scoped refresh for core operational tables.

## 2. System Architecture

### Frontend
- `Confirmed` Framework and runtime:
- React 19, TypeScript, Vite, React Router (`src/index.tsx`, `src/App.tsx`).
- UI state is local React state + small context providers; no Redux/Zustand.
- `Confirmed` Folder structure (high-level):
- `src/apps/busflow/*`: core BusFlow app, API layer, components, types.
- `src/pages/*`: top-level routes (`PlatformAdmin`, `TeamAdmin`, `AcceptInvite`, etc.).
- `src/shared/*`: auth context, Supabase client, function wrapper, shared UI providers/components.
- `Confirmed` Supabase client setup:
- Single browser client in `src/shared/lib/supabase.ts` via `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`.
- Placeholder fallback values avoid hard crash if env is missing; app flow still depends on valid env.
- `Confirmed` Auth handling:
- Login: `signInWithPassword` in `src/App.tsx`.
- Session/profile/account resolution in `src/shared/auth/AuthContext.tsx`.
- Realtime sync updates role/account state from `profiles` and `account_memberships` changes.
- Invite acceptance flow in `src/pages/AcceptInvite.tsx`:
- Parse `token_hash` and `type`.
- `supabase.auth.verifyOtp(...)`.
- `supabase.auth.updateUser({ password })`.
- `supabase.rpc('claim_my_invitation', { p_account_id: null })`.
- `Confirmed` State management model:
- Global auth/account state in `AuthContext`.
- Domain state in `BusflowApp.tsx` (routes/settings/customers/import UI states).
- Toast/progress providers for UX feedback.
- `Confirmed` API calling strategy:
- Standard data: direct `supabase.from(...)/rpc(...)` with account_id filters and RLS enforcement.
- Privileged admin actions: `invokeAuthedFunction(...)` in `src/shared/lib/supabaseFunctions.ts`, internally using `supabase.functions.invoke(...)`.
- Wrapper does session precheck, one refresh retry on JWT errors, and normalized auth error mapping.

### Backend (Supabase)
- `Confirmed` Project structure:
- SQL migrations at repo root (`supabase_migration_phase*.sql`) are operational source of truth.
- Edge functions in `supabase/functions/*`.
- Function config in `supabase/config.toml`.
- `Confirmed` Auth model:
- Supabase Auth (`auth.users`) + profile extension (`public.profiles`).
- Role model combines global role and account membership role.
- `Confirmed` Role system:
- Global role in `profiles.global_role`: `ADMIN | USER`.
- Account role in `account_memberships.role`: `ADMIN | DISPATCH | VIEWER`.
- Membership status in `account_memberships.status`: `ACTIVE | INVITED | SUSPENDED`.
- Invitation role/status in `account_invitations`.
- `Confirmed` Admin logic split:
- Platform admin UI route `/platform-admin`.
- Tenant admin UI route `/team-admin`.
- Legacy `/admin` route redirects and old `src/pages/Admin.tsx` remains in repo as historical/legacy code path.

## 3. Database Schema Overview

### Core Tables and Responsibilities
- `Confirmed` `profiles`
- PK: `id` (matches `auth.users.id`).
- Stores user identity metadata and `global_role`.
- `Confirmed` `app_permissions`
- Per-app compatibility roles (`busflow`), legacy compatibility still used by some historical policy phases.
- `Confirmed` `platform_accounts`
- Tenant/account master (`name`, `slug`, lifecycle `status`, `archived_at`, `archived_by`, timestamps).
- `Confirmed` `account_memberships`
- Joins users to accounts with role + status.
- Unique `(account_id, user_id)`.
- Partial unique index enforces max one `ACTIVE` membership per user (`phase31`).
- `Confirmed` `account_invitations`
- Invite records with email/role/status/token/expiry and inviter reference.
- Unique pending invite per `(account_id, lower(email))`.
- `Confirmed` `admin_access_audit`
- Platform/admin action audit.
- Since `phase36`, FKs to `profiles` and `platform_accounts` are `ON DELETE SET NULL` to retain logs after hard deletes.
- `Confirmed` BusFlow domain tables
- `busflow_routes`, `busflow_stops`, `busflow_customers`, `busflow_customer_contacts`, `busflow_workers`, `busflow_bus_types`, `busflow_app_settings`.
- Tenant-scoped by `account_id` after phases 23-26.

### Relationships and FK Behavior
- `Confirmed` `account_memberships.account_id -> platform_accounts.id ON DELETE CASCADE`.
- `Confirmed` `account_memberships.user_id -> profiles.id ON DELETE CASCADE`.
- `Confirmed` `account_invitations.account_id -> platform_accounts.id ON DELETE CASCADE`.
- `Confirmed` `account_invitations.invited_by -> profiles.id` (nullable by cleanup logic in functions).
- `Confirmed` `admin_access_audit.admin_user_id -> profiles.id ON DELETE SET NULL`.
- `Confirmed` `admin_access_audit.target_account_id -> platform_accounts.id ON DELETE SET NULL`.
- `Confirmed` `profiles.id -> auth.users.id ON DELETE CASCADE` (legacy baseline and consistent behavior assumptions).
- `Confirmed` busflow table `account_id` columns reference `platform_accounts`; account deletion is currently performed by explicit purge order in edge function (not FK cascade-based single delete).

### RLS and Policy Model
- `Confirmed` Tenant policy hardening is established via phases 24 and 27:
- RLS + FORCE RLS on tenant-sensitive tables.
- Canonical read/write policies based on helper functions (`is_platform_admin`, `has_account_access`, `account_role`, `can_manage_account`).
- `Confirmed` Membership and invitation management policy expanded in phase31/30:
- Account admins can view/manage own account memberships/invitations.
- Platform admins retain global override.
- `Confirmed` Direct delete lockdown in `phase37`:
- Deletes on `profiles` and `platform_accounts` from client policy path removed.
- Intended path: audited edge functions for hard delete.

### Role Structure and Membership Logic
- `Confirmed` Effective authorization uses two layers:
- Platform authority: `profiles.global_role = ADMIN`.
- Tenant authority: active membership role in account.
- `Confirmed` Invitation lifecycle:
- New invite stays `PENDING`.
- Signup trigger creates `INVITED` membership.
- `claim_my_invitation()` transitions membership to `ACTIVE` and invitation to `ACCEPTED`.
- `Historical` Earlier implementation accepted invitation too early in `handle_new_user`; corrected in phase32.

### User Deletion Impact Chain
- `Confirmed` For hard-delete via `admin-delete-user-v3`:
- Cleanup references in `platform_accounts.created_by`, `platform_accounts.archived_by`, `account_invitations.invited_by` to `NULL`.
- Revoke pending invites by target email (`account_invitations.status = REVOKED`).
- Delete `app_permissions` rows for user.
- Delete all `account_memberships` rows for user.
- Call `auth.admin.deleteUser(userId)`; this removes `auth.users` and cascades/affects dependent profile records.
- Insert audit entry in `admin_access_audit`.
- `Confirmed` Audit retention after delete is preserved by `ON DELETE SET NULL` FKs (`phase36`).

## 4. Edge Functions

### `invite-account-user`
- `Purpose` Invite user into specific account with role (`ADMIN|DISPATCH|VIEWER`).
- `Auth flow` Requires bearer token, parses manually, validates via `callerClient.auth.getUser(accessToken)`.
- `Role validation` Platform admin can invite for any account; tenant admin only for own account.
- `Security checks` Email format, role whitelist, pending invite dedupe, active membership conflict checks.
- `Service role usage` Create invitation row and call `auth.admin.inviteUserByEmail` with redirect metadata.
- `Cleanup logic` None destructive; prevents duplicate or cross-account active conflicts.
- `Known issues` Uses wildcard CORS; currently `verify_jwt=false` fallback (temporary incident posture).

### `platform-provision-account`
- `Purpose` Create account + first admin invite in one function flow.
- `Auth flow` Manual bearer parse + `getUser(accessToken)`.
- `Role validation` Requires caller global platform admin.
- `Security checks` Valid slug/email, redirect URL required/validated, unique slug handling.
- `Service role usage` Create `platform_accounts`, insert invitation, send invite email, write audit.
- `Known issues` Multi-step operations are not wrapped in explicit DB transaction; partial success scenarios handled by response codes/audit.

### `platform-send-password-reset`
- `Purpose` Platform support action to send reset link for user in account scope.
- `Auth flow` Manual bearer parse + user validation.
- `Role validation` Platform admin only.
- `Security checks` Account existence, email format, membership check before reset call.
- `Service role usage` `auth.resetPasswordForEmail` and audit write.
- `Security behavior` Neutral response strategy to reduce user enumeration.

### `platform-delete-account`
- `Purpose` Dry-run + hard delete of account and account-scoped data.
- `Auth flow` Manual bearer parse + user validation.
- `Role validation` Platform admin only.
- `Security checks` UUID validation, account existence, slug confirmation for destructive delete.
- `Service role usage` Purges account-scoped rows, deletes account, deletes orphan non-platform-admin users, writes audit.
- `Cleanup logic` Explicit purge order across busflow and membership/invitation tables, then optional orphan auth user deletion.
- `Known issues`
- No explicit transaction boundary; failures mid-sequence may require manual reconciliation.
- Orphan user deletion loop can produce partial failures captured in `orphanDeleteErrors`.

### `admin-delete-user` (legacy)
- `Purpose` Original hard-delete user implementation.
- `Auth flow` Relies on forwarded Authorization header in Supabase client global headers and `getUser()` without explicit token parameter.
- `Role validation` Platform admin global, tenant admin scoped account rules.
- `Security checks` Self-delete and last-admin guards.
- `Known issues` Associated with repeated `401 Invalid JWT` gateway incidents when `verify_jwt=true`.

### `admin-delete-user-v2` (legacy canary)
- `Purpose` Slug-rotated retry of legacy behavior.
- `Auth flow` Same header-forwarding pattern as v1.
- `Known issues` Also observed in JWT gateway failures despite valid-looking session contexts.

### `admin-delete-user-v3` (current canonical delete endpoint)
- `Purpose` Current active hard-delete path used by frontend APIs.
- `Auth flow` Strict manual bearer parsing + explicit `callerClient.auth.getUser(accessToken)`.
- `Role validation`
- Platform admin: global delete authority.
- Tenant admin: only for own account and role-guarded scope.
- `Security checks`
- `SELF_DELETE_FORBIDDEN`.
- `LAST_PLATFORM_ADMIN_FORBIDDEN`.
- `LAST_ACCOUNT_ADMIN_FORBIDDEN`.
- `USER_SCOPE_VIOLATION`.
- `Service role usage` Reference cleanup + membership/app_permission deletion + `auth.admin.deleteUser` + audit insert.
- `Known issues`
- Currently deployed with `verify_jwt=false` temporary fallback while function-internal auth validation is authoritative.

### Special Focus: Token Validation and 401 Behavior
- `Confirmed` Frontend currently calls functions via `supabase.functions.invoke(...)` through `invokeAuthedFunction` wrapper.
- `Confirmed` Wrapper behavior:
- Ensures session exists.
- Invokes function.
- On `401 Invalid JWT`, runs `refreshSession()` once and retries once.
- Raises normalized auth errors if still invalid.
- `Historical` During incident windows, valid token metadata was visible in Supabase logs but gateway still returned `401 Invalid JWT` before function logic for specific delete slugs.
- `Open` Root-cause at provider gateway level is not fully closed in repo; mitigation is operational fallback (`verify_jwt=false` on active admin functions + strict in-function token validation).

### `invoke` vs `fetch`
- `Confirmed` Current implementation uses SDK invoke (`supabase.functions.invoke`) in wrapper.
- `Historical` Custom/manual fetch transport was experimented with during forensics and then replaced by SDK invoke path.
- `Confirmed` No direct function-subdomain fetch transport remains in `src/`.

## 5. Authentication Flow
- `Confirmed` Supabase Auth flow in project:
- Browser session managed by Supabase JS client.
- Login through `signInWithPassword`.
- Auth state handled by `onAuthStateChange` in `AuthContext`.
- `Confirmed` Access token vs refresh token:
- Access token is used for function authorization and REST/RPC requests.
- Refresh token is used by Supabase client to renew session when needed.
- `Confirmed` Token storage:
- Standard Supabase JS browser persistence (local storage based by default behavior).
- `Confirmed` Token transmission to functions:
- Via `supabase.functions.invoke` with auth context.
- Function wrapper also prechecks session and retries after refresh on JWT errors.
- `Confirmed` Function-side verification (active admin functions):
- Explicit bearer parse.
- `callerClient.auth.getUser(accessToken)` to validate caller identity.
- Role/scope checks via service-role DB lookups.
- `Historical` Why `401 -> refresh -> 401` occurred:
- Gateway JWT rejection happened before function business logic for specific function slugs/config states.
- Session refresh did not resolve those cases consistently.
- `Confirmed` Current practical solution in repo:
- Keep frontend invoke wrapper with retry + normalized errors.
- Temporarily run active admin functions with `verify_jwt=false` and strict internal token validation.

## 6. Bugs & Errors We Encountered

### Bug A: Invite user could not set initial password
- `Root cause` Invite flow sent user to app without dedicated password setup route handling invite token.
- `Fix` Added `AcceptInvite` route/page and flow (`verifyOtp -> updateUser(password) -> claim_my_invitation`).
- `Prevention` Keep invite redirect env mandatory and test invite onboarding end-to-end after deploy.

### Bug B: Invitation accepted too early on user creation
- `Root cause` Earlier trigger (`handle_new_user`) accepted invitation immediately during auth user creation.
- `Fix` Phase32 changed trigger to keep invitation `PENDING`, create membership `INVITED`, then accept only in `claim_my_invitation()`.
- `Prevention` Preserve explicit claim step invariant and add smoke tests for pending/accepted transitions.

### Bug C: Mixed platform and tenant admin responsibilities
- `Root cause` Single admin surface mixed cross-tenant and tenant-scoped actions.
- `Fix` Split routes/pages into `/platform-admin` and `/team-admin`, keep `/admin` as compatibility redirect.
- `Prevention` Maintain strict route guard logic and avoid re-merging responsibilities.

### Bug D: Hard delete blocked by audit FK constraints
- `Root cause` `admin_access_audit` foreign keys originally prevented profile/account delete retention behavior.
- `Fix` Phase36 changed audit FKs to `ON DELETE SET NULL` and made `admin_user_id` nullable.
- `Prevention` Keep audit table FK behavior compatible with destructive maintenance operations.

### Bug E: Direct client delete path risk on sensitive tables
- `Root cause` Legacy delete policies could allow un-audited direct deletes.
- `Fix` Phase37 removed DELETE policies on `profiles` and `platform_accounts`.
- `Prevention` Keep destructive actions behind audited edge functions only.

### Bug F: Repeated `401 Invalid JWT` on admin delete
- `Root cause` Function-specific gateway JWT validation instability (observed across slug rotations in forensics), not classic expired-token-only scenario.
- `Fix` Multiple mitigation steps:
- Wrapper-level session precheck + refresh retry.
- Slug rotations (`admin-delete-user`, `-v2`, `-v3`).
- Current operational fallback: `verify_jwt=false` for active admin functions + strict internal token verification.
- `Prevention`
- Preserve forensic logging (`status`, `sb-request-id`, token metadata only).
- Re-enable `verify_jwt=true` incrementally only after provider-side confidence.

### Bug G: Environment mismatch risk (URL/key/project drift)
- `Root cause` Frontend and function runtime can target different refs/keys if envs drift.
- `Fix` Added setup docs and forensic checklist; validated ref consistency in incident process.
- `Prevention` Enforce environment manifest and deploy checklist per environment.

### Bug H: Legacy admin page drift
- `Root cause` `src/pages/Admin.tsx` still exists but is not routed in active app flow.
- `Fix` Functional split was done; legacy file remains.
- `Prevention` Document clearly as legacy and remove only in controlled cleanup step.

## 7. Security Overview
- `Confirmed` Service-role usage:
- Used only inside edge functions for privileged DB/Auth admin actions.
- Frontend never receives service-role credentials.
- `Confirmed` Token validation logic (active admin functions):
- Strict bearer parse.
- Explicit `getUser(accessToken)` validation.
- Role checks via `profiles.global_role` and account membership checks.
- `Confirmed` Deletion protections:
- No self-delete.
- Cannot delete last platform admin.
- Tenant admin cannot delete last active account admin in own account.
- Tenant scope violation blocked.
- `Confirmed` Account-scope validation:
- Enforced through RLS helpers + function checks + account_id filters in frontend queries.
- `Confirmed` Audit coverage:
- Support/provision/delete flows write `admin_access_audit` entries.
- Audit survives hard delete through `SET NULL` FKs.

### Possible Vulnerabilities / Weak Spots
- `Open` Temporary security posture: active admin functions run with `verify_jwt=false` due gateway incident.
- `Open` CORS is wildcard (`Access-Control-Allow-Origin: *`) in functions; bearer requirement mitigates but policy can be tightened.
- `Open` Hard-delete flows are multi-step and not transactional; partial deletes are possible under mid-flight errors.
- `Open` Some platform account lifecycle updates happen via direct table update from frontend API path (still protected by RLS, but less auditable than function-based writes).
- `Open` Multiple function generations (`v1/v2/v3`) increase operational complexity.

### Recommended Security Improvements
- Re-introduce `verify_jwt=true` per function after upstream stability validation.
- Tighten CORS origins in production.
- Move all privileged platform state mutations behind audited edge functions.
- Add idempotency keys or transactional SQL wrappers for destructive workflows where feasible.

## 8. Deployment & Environment
- `Confirmed` Required frontend env (`.env.example`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `Confirmed` Required function secrets:
- `APP_INVITE_REDIRECT_URL`
- `APP_PASSWORD_RESET_REDIRECT_URL`
- Runtime-provided by Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `Confirmed` Function config (`supabase/config.toml` current state):
- `verify_jwt=false` on active admin/invite/provision/reset/delete functions.
- `verify_jwt=true` remains on legacy `admin-delete-user` and `admin-delete-user-v2`.
- `Confirmed` Local checks:
- `npm run check` (typecheck + lint + build).
- `npm run test` delegates to smoke (`test:smoke -> check`).

### Local vs Staging vs Production
- `Confirmed` Intended separation is documented; same code supports multiple refs via env.
- `Open` Risk if frontend env points to different project than deployed functions or secrets.

### Common Misconfigurations
- Missing invite/reset redirect secrets.
- Redirect URL not allowlisted in Supabase Auth URL configuration.
- Project ref mismatch between frontend env and function deploy target.
- Cached old frontend bundle using stale function slug/config.
- Accidentally deploying function with inconsistent `verify_jwt` mode vs expected runtime behavior.

## 9. Open Issues & Technical Debt
- `Open` Temporary fallback mode: active admin functions rely on `verify_jwt=false` + internal auth checks.
- `Open` Legacy function slugs (`admin-delete-user`, `admin-delete-user-v2`) still deployed/kept.
- `Open` `smart-function` exists remotely (manifest notes no local source in repo) and is a cleanup candidate pending usage proof.
- `Open` `src/pages/Admin.tsx` remains as unused legacy page file.
- `Open` Large files remain difficult to maintain (`BusflowApp.tsx`, admin pages, some large components).
- `Open` Docs drift exists: multiple docs across phases can diverge from current canonical behavior.
- `Open` No dedicated unit/integration test suite; current test command is smoke-level static gate.
- `Open` Hard-delete account/user flows are operationally strong but not fully transactional end-to-end.

## 10. Recommendations for Future AI

### How to Understand This System Quickly
- Start from `src/App.tsx` route guards and `src/shared/auth/AuthContext.tsx` for identity/account context.
- Then read `src/shared/lib/supabaseFunctions.ts` to understand privileged function invocation and JWT handling.
- For backend truth, read migrations in this order: `phase22 -> phase24 -> phase27 -> phase30 -> phase31 -> phase32 -> phase33 -> phase34 -> phase36 -> phase37`.
- Treat `supabase_schema.sql` as historical reference only.

### What Must Stay Consistent
- Migration-first governance: schema/policy/function changes only via migration files.
- Invite lifecycle invariant: invitation remains `PENDING` until explicit claim; membership transitions `INVITED -> ACTIVE` via claim.
- One active account membership per user invariant (`phase31` partial unique index).
- Hard delete guardrails: no self-delete, no deleting last platform admin, no deleting last tenant admin from tenant-admin scope.
- Audited admin operations must remain traceable in `admin_access_audit`.

### What Not to Change Blindly
- Do not remove account-scope checks (`account_id` filters, RLS helper usage, function role checks).
- Do not reintroduce direct client deletes on `profiles` or `platform_accounts`.
- Do not collapse platform and tenant admin surfaces back into a single mixed-authority workflow.
- Do not delete legacy function slugs until rollout stability + rollback strategy are explicitly confirmed.

### Where to Be Careful
- Auth transport and token lifecycle in function calls (`invokeAuthedFunction`).
- `verify_jwt` posture transitions (must be coordinated with runtime evidence).
- Multi-step hard-delete flows (consider idempotency/recovery path).
- RLS policy edits (small changes can silently break cross-tenant isolation).

### Critical Invariants for Any Future Refactor
- Tenant isolation by `account_id` must remain enforced at both policy and application levels.
- Platform-admin-only actions must stay behind explicit global role checks.
- Account-admin actions must remain limited to their account scope.
- Invite onboarding must never require plaintext temp-password delivery.
- Audit retention must survive destructive operations.
