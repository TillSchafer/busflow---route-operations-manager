# Role Model (Canonical)

## Purpose
This document defines the canonical meaning of all role fields in the platform.

## Role Layers

1. Platform role (`profiles.global_role`)
- Scope: whole platform (cross-tenant).
- Values: `ADMIN`, `USER`.
- Meaning:
  - `ADMIN`: platform administration and owner/platform operations.
  - `USER`: default platform user.

2. Tenant role (`account_memberships.role`)
- Scope: one `platform_accounts` tenant.
- Values: `ADMIN`, `DISPATCH`, `VIEWER`.
- Meaning:
  - `ADMIN`: tenant user administration and tenant-level app management.
  - `DISPATCH`: operational write access for BusFlow.
  - `VIEWER`: read-only operational access.

3. Invitation role (`account_invitations.role`)
- Scope: pre-membership onboarding state.
- Values: `ADMIN`, `DISPATCH`, `VIEWER`.
- Meaning: role that will be assigned to `account_memberships.role` on successful claim.

4. Worker job role (`busflow_workers.role`)
- Scope: business/domain data only.
- Examples: `Driver`, `Mechanic`.
- Note: this is NOT an authorization role.

## Legacy Role Storage

`app_permissions.role` is considered legacy and no longer authoritative for runtime authorization.
Authorization decisions must be based on:
- `profiles.global_role` (platform)
- `account_memberships.role` and `account_memberships.status` (tenant)

## Authorization Source of Truth

- Platform checks: `profiles.global_role`
- Tenant checks: `account_memberships` via `has_account_access()` and `account_role()`
- Invitation onboarding: `account_invitations` + `claim_my_invitation()`

## Anti-Drift Rules

1. Do not add new authorization logic that depends on `app_permissions`.
2. New role-changing flows must go through audited Edge Functions.
3. Keep invitation lifecycle consistent: `PENDING -> ACCEPTED|REVOKED|EXPIRED`.
4. Keep one active tenant membership per user unless product strategy changes.
