# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**Supabase Edge Functions (HTTP endpoints):**
- Platform/admin/user lifecycle:
  - `invite-account-user`
  - `admin-manage-invitation-v1`
  - `admin-update-membership-role-v1`
  - `admin-delete-user-v3`
  - `platform-provision-account`
  - `platform-delete-account`
  - `owner-company-overview-v1`
  - `owner-update-account-v1`
- Profile/security/public flows:
  - `self-profile-security-v1`
  - `public-register-trial-v1`
- Inventory-only (currently no runtime caller in `src/`):
  - `platform-send-password-reset`
  - `admin-update-user-v1`

**Client integration methods:**
- Authenticated function calls: `invokeAuthedFunction(...)` in `src/shared/lib/supabaseFunctions.ts`.
- Public registration call: direct `fetch` to `/functions/v1/public-register-trial-v1` in `src/shared/api/public/registerTrial.api.ts`.

## Data Storage

**Primary database:**
- PostgreSQL on Supabase.
- Access paths:
  - PostgREST table queries from frontend (e.g., `profiles`, `account_memberships`, `busflow_routes`, `busflow_stops`).
  - RPC calls for canonical writes/ops, e.g.:
    - `save_busflow_route_with_stops`
    - `claim_my_invitation`
    - `mark_expired_invitations`

**Migrations:**
- Source of truth under `supabase/migrations/*.sql`.
- Active migration track includes tenant/account and profile security hardening.

**File storage:**
- No direct Supabase Storage upload flow found in current frontend code.
- Profile uses URL field (`avatar_url`) rather than file upload pipeline.

## Authentication & Identity

**Auth provider:**
- Supabase Auth (email/password + invitation/recovery links).
- Session lifecycle handled in `src/shared/auth/AuthContext.tsx` with `getSession()` + `onAuthStateChange`.

**Callback/redirect routes:**
- `/auth/accept-invite`
- `/auth/account-security`
- `AuthCallbackNormalizer` reroutes callback params by `type` (`email_change` => account security).

**Redirect env/secret coupling:**
- Frontend env: `VITE_PASSWORD_RESET_REDIRECT_URL`, `VITE_ACCOUNT_SECURITY_REDIRECT_URL`.
- Function secrets: `APP_INVITE_REDIRECT_URL`, `APP_PASSWORD_RESET_REDIRECT_URL`, `APP_ACCOUNT_SECURITY_REDIRECT_URL`.

## Realtime Integration

**Supabase Realtime channels:**
- Auth membership/profile synchronization in `AuthContext`:
  - channel: `auth-role-sync-{userId}` on `profiles` + `account_memberships`.
- BusFlow operational refresh in `useRealtimeSync`:
  - channel: `busflow-live-sync-{accountId}` on routes/stops/customers/settings tables.

## Monitoring & Observability

**Analytics:**
- Vercel Analytics (`@vercel/analytics/react`) enabled in `AppProviders`.

**Performance telemetry:**
- Vercel Speed Insights (`@vercel/speed-insights/react`) enabled in `AppProviders`.

**Error logging:**
- Primarily `console.error` / `console.warn` in frontend and scripts.
- No Sentry/Datadog-style external error aggregation found.

## CI/CD & Deployment

**Hosting:**
- SPA-hosting target compatible with Vercel (`vercel.json` rewrite all paths to `/index.html`).

**CI pipeline:**
- No `.github/workflows/*` found.
- Quality gate is local/scripted via:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - combined as `npm run check`.

## Environment Configuration

**Development:**
- Required vars in `.env.local` using `.env.example` contract.
- Supabase function secrets set via CLI/dashboard (not in Vite env files).

**Staging/Production:**
- Same variable names with environment-specific values.
- Must use separate Supabase projects/keys per environment.

## Webhooks & Callbacks

**Incoming callbacks (auth links):**
- Supabase Auth emails redirect users to frontend routes for invite, email-change, and password-reset completion.

**Outgoing integrations:**
- No third-party outgoing webhooks (Stripe/SendGrid/etc.) detected in current runtime code.

---

*Integration audit: 2026-02-26*
*Update when adding/removing external services or function contracts*
