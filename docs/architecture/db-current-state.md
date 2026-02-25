# DB Current State (Architecture Snapshot)

## Scope
Snapshot based on migration chain and current Edge/Frontend usage.

## Domain Inventory

### Identity & Authorization
- `profiles`
  - platform user profile and platform-level role (`global_role`).
- `account_memberships`
  - tenant membership (`account_id`, `user_id`, tenant `role`, `status`).
- `account_invitations`
  - tenant invite lifecycle and pre-claim role.
- `app_permissions` (legacy)
  - old app-level role mapping; currently not required as runtime authority.

### Tenant & Governance
- `platform_accounts`
  - tenant master (`status`, archival metadata, owner metadata).
- `admin_access_audit`
  - platform/admin action audit trail.

### BusFlow Operational Data
- `busflow_routes`
- `busflow_stops`
- `busflow_customers`
- `busflow_customer_contacts`
- `busflow_workers`
- `busflow_bus_types`
- `busflow_app_settings`

All listed BusFlow tables are account-scoped via `account_id` with tenant RLS and account-integrity checks.

## Security & Isolation

### RLS
- Tenant RLS model is based on helper functions:
  - `is_platform_admin()`
  - `has_account_access(account_id)`
  - `account_role(account_id)`
  - `can_manage_account(account_id)`
- `FORCE RLS` lock-down introduced in phase 27.
- SECURITY DEFINER hardening for recursion-sensitive functions in phase 38.

### FK Retention & Delete Behavior
- Account-scoped BusFlow FKs on `platform_accounts` are ON DELETE CASCADE (phase 40).
- Audit FKs (`admin_access_audit.admin_user_id`, `target_account_id`) are ON DELETE SET NULL.

## Invite/Auth Lifecycle
- Deferred claim model (phase 32/39):
  - invite remains `PENDING` until explicit `claim_my_invitation()`.
  - membership is created as `INVITED` before claim.
- Invite edge flows include resend/ghost cleanup hardening.

## Runtime Usage Snapshot

### Actively used for authorization
- `profiles.global_role`
- `account_memberships.role` + `account_memberships.status`

### Transition/legacy
- `app_permissions`
  - still present and historically populated by old trigger variants.
  - should not be used as authorization source.

## Drift/Design Risks

1. Legacy overlap risk
- `app_permissions` can drift from membership roles if still written.

2. Governance gap (before hardening)
- direct table updates from UI can bypass audit/business safeguards.

3. Bootstrap reproducibility risk
- early migrations historically assume baseline objects; explicit baseline bootstrap is required for greenfield reliability.

4. Lifecycle hygiene risk
- expired invitations may remain `PENDING` without periodic/on-read normalization.

## Targeted Corrective Actions (implemented/expected)

1. Legacy deprecation path
- stop writing `app_permissions` in onboarding trigger.
- keep `app_permissions` read-only legacy.

2. Audited role changes
- enforce tenant role updates via Edge Function + audit (`admin_update_membership_role`).

3. Lifecycle consistency
- explicit function to mark expired invitations (`mark_expired_invitations`).

4. Bootstrap hardening
- baseline migration for greenfield setup + stricter preflight assertions.

## Suggested Operational Checks
- Run `docs/migrations/supabase_phase42b_readonly_invite_checks.sql`
- Run `docs/migrations/supabase_phase43_readonly_architecture_checks.sql`
