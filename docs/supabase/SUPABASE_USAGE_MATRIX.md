# Supabase Usage Matrix

This matrix maps runtime code usage to Supabase artifacts.

## Runtime Tables Used by Frontend Code

| Artifact | Used by | Notes |
|---|---|---|
| `platform_accounts` | `src/pages/Admin.tsx` | Account listing and validation in admin UI. |
| `account_memberships` | `src/shared/auth/AuthContext.tsx`, `src/pages/Admin.tsx` | Active account resolution, role/membership management. |
| `account_invitations` | `src/pages/Admin.tsx`, `supabase/functions/invite-account-user/index.ts` | Invite creation/list/revoke. |
| `profiles` | `src/shared/auth/AuthContext.tsx`, `supabase/functions/invite-account-user/index.ts` | Profile and role lookup. |
| `busflow_routes` | `src/apps/busflow/api/index.ts` via routes API | CRUD for routes. |
| `busflow_stops` | `src/apps/busflow/api/index.ts` via route RPC/query | Stop persistence with routes. |
| `busflow_customers` | `src/apps/busflow/api/index.ts` via customer/contact/import APIs | Company/customer data and lookups. |
| `busflow_customer_contacts` | `src/apps/busflow/api/index.ts` via contact/import APIs | Contact-centered customer model. |
| `busflow_workers` | `src/apps/busflow/api/index.ts` via settings API | Driver list CRUD. |
| `busflow_bus_types` | `src/apps/busflow/api/index.ts` via settings API | Bus type CRUD. |
| `busflow_app_settings` | `src/apps/busflow/api/index.ts` via settings API | Map default view storage. |
| `admin_access_audit` | DB-side auditing (RLS/trigger migrations) | No direct UI reads except policy context. |
| `app_permissions` | Transitional compatibility (`handle_new_user`) | Still written by onboarding trigger. |

## Runtime RPC / SQL Functions Used by Frontend Code

| Function | Used by | Notes |
|---|---|---|
| `save_busflow_route_with_stops` | `src/apps/busflow/api/routes.api.ts` | Canonical route save with concurrency + account checks. |
| `claim_my_invitation` | `src/shared/auth/AuthContext.tsx` | Invitation claim / activation. |

## Edge Functions

| Function | Used by | Notes |
|---|---|---|
| `invite-account-user` | `src/pages/Admin.tsx` (`supabase.functions.invoke`) | Invite-only onboarding flow; JWT verification enabled in config. |

## Migration Drift Hotspots (multiple definitions)

| Function | Migration files defining/redefining |
|---|---|
| `handle_new_user` | phases 7, 12, 31, 32 |
| `save_busflow_route_with_stops` | phases 9, 10, 12, 14b, 17b, 20b, 26, 29 |
| `enforce_busflow_account_integrity` | phases 24, 27, 29 |

## Cleanup Implications

- These functions cannot be dropped blindly from current schema; cleanup must be migration-driven and only remove obsolete compatibility paths after confirming canonical latest definition.
- `app_permissions` is still part of onboarding compatibility and therefore not a drop candidate yet.

