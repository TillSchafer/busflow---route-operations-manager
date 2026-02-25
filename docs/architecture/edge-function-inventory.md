# Edge Function Inventory (Phase 1 Cleanup)

Date: 2026-02-24
Project ref: `jgydzxdiwpldgrqkfbfk`

## Remote Functions (CLI Snapshot)
Source: `npx supabase functions list --project-ref jgydzxdiwpldgrqkfbfk`

- `smart-function`
- `invite-account-user`
- `platform-provision-account`
- `platform-send-password-reset`
- `platform-delete-account`
- `admin-delete-user`
- `admin-delete-user-v2`
- `admin-delete-user-v3`
- `admin-update-user-v1`
- `owner-update-account-v1`
- `owner-company-overview-v1`
- `admin-manage-invitation-v1`
- `admin-update-membership-role-v1`

## Remote Functions (After conservative cleanup)
Source: `npx supabase functions list --project-ref jgydzxdiwpldgrqkfbfk` (post-delete)

- `invite-account-user`
- `platform-provision-account`
- `platform-send-password-reset`
- `platform-delete-account`
- `admin-delete-user-v3`
- `admin-update-user-v1`
- `owner-update-account-v1`
- `owner-company-overview-v1`
- `admin-manage-invitation-v1`
- `admin-update-membership-role-v1`

## Local Function Directories
Source: `find supabase/functions -mindepth 1 -maxdepth 1 -type d`

- `_shared`
- `admin-delete-user-v3`
- `admin-manage-invitation-v1`
- `admin-update-membership-role-v1`
- `admin-update-user-v1`
- `invite-account-user`
- `owner-company-overview-v1`
- `owner-update-account-v1`
- `platform-delete-account`
- `platform-provision-account`
- `platform-send-password-reset`

## Usage Matrix (App Runtime)
Source: `rg` over `src/`, `supabase/config.toml`, docs.

| Function | Used in frontend runtime | Local source exists | Remote exists | Classification |
|---|---:|---:|---:|---|
| `invite-account-user` | yes | yes | yes | active |
| `platform-provision-account` | yes | yes | yes | active |
| `platform-send-password-reset` | yes (via `SupportAdminApi`, currently not wired in UI) | yes | yes | keep (phase 2 candidate) |
| `platform-delete-account` | yes | yes | yes | active |
| `admin-delete-user-v3` | yes | yes | yes | active canonical |
| `admin-manage-invitation-v1` | yes | yes | yes | active |
| `admin-update-membership-role-v1` | yes | yes | yes | active |
| `owner-update-account-v1` | yes | yes | yes | active |
| `owner-company-overview-v1` | yes | yes | yes | active |
| `admin-update-user-v1` | no | yes | yes | keep (phase 2 candidate) |
| `admin-delete-user` | no | no | yes | remove now |
| `admin-delete-user-v2` | no | no | yes | remove now |
| `smart-function` | no | no | yes | remove now |

## Conservative Cleanup Decision (Implemented in this phase)
Removed:
- `admin-delete-user`
- `admin-delete-user-v2`
- `smart-function`

Keep for now:
- `platform-send-password-reset`
- `admin-update-user-v1`
