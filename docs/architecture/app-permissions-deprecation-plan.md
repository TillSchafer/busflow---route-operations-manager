# app_permissions Deprecation Plan

## Status
`app_permissions` is legacy compatibility storage and no longer the intended authorization authority.

## Target
Runtime authorization uses only:
- `profiles.global_role`
- `account_memberships.role` + `account_memberships.status`

## Step Plan

1. Freeze writes
- keep only read policy for client-facing access.
- remove onboarding writes to `app_permissions` (`handle_new_user`).

2. Observe
- monitor for runtime errors or missing permissions in UI/API.
- run architecture checks weekly during stabilization window.

3. Cleanup preparation
- verify no app/runtime query requires `app_permissions` for authorization.
- keep table as read-only historical artifact until sign-off.

4. Drop phase (future)
- migration to remove table and policies only after sign-off.
- update all docs to remove legacy references.

## Backout Strategy

If issues appear after write-freeze:
1. restore previous `handle_new_user()` behavior (temporary write-back).
2. re-enable insert/update policies for `app_permissions`.
3. replay missing rows for affected users from membership snapshots.

## Validation Checklist
- no critical runtime path checks `app_permissions` for access decisions.
- role changes are audited and server-side enforced.
- invite onboarding works without creating `app_permissions` rows.
