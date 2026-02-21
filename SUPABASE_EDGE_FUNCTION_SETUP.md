# Supabase Edge Functions Setup (Schritt fuer Schritt)

Diese Anleitung richtet die produktiven Functions in BusFlow ein:
- `invite-account-user`
- `platform-provision-account`
- `platform-send-password-reset`
- `admin-delete-user`
- `admin-delete-user-v2`
- `admin-delete-user-v3`
- `platform-delete-account`

## 1) Voraussetzungen

```bash
npm install
npx supabase --version
```

Wenn die CLI fehlt:

```bash
npm install -D supabase
```

Login und Link:

```bash
npx supabase login
npx supabase link --project-ref jgydzxdiwpldgrqkfbfk
```

## 2) Edge Function erstellen

Nur notwendig, wenn sie noch nicht existiert:

```bash
npx supabase functions new invite-account-user
npx supabase functions new platform-provision-account
npx supabase functions new platform-send-password-reset
npx supabase functions new admin-delete-user
npx supabase functions new admin-delete-user-v2
npx supabase functions new admin-delete-user-v3
npx supabase functions new platform-delete-account
```

Erwartete Struktur:
- `supabase/functions/invite-account-user/index.ts`
- `supabase/functions/platform-provision-account/index.ts`
- `supabase/functions/platform-send-password-reset/index.ts`
- `supabase/functions/admin-delete-user/index.ts`
- `supabase/functions/admin-delete-user-v2/index.ts`
- `supabase/functions/admin-delete-user-v3/index.ts`
- `supabase/functions/platform-delete-account/index.ts`

## 3) Code in `index.ts` einsetzen

Nimm pro Function dieses sichere Grundgeruest und ergaenze die Business-Logik:

```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { ok: false, code: 'UNAUTHORIZED' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await callerClient.auth.getUser();
  if (error || !user) return json(401, { ok: false, code: 'UNAUTHORIZED' });

  // Hier deine Business-Logik
  return json(200, { ok: true });
});
```

## 4) `supabase/config.toml` setzen

```toml
project_id = "jgydzxdiwpldgrqkfbfk"

[functions.invite-account-user]
verify_jwt = false

[functions.platform-provision-account]
verify_jwt = false

[functions.platform-send-password-reset]
verify_jwt = false

[functions.admin-delete-user]
verify_jwt = true

[functions.admin-delete-user-v2]
verify_jwt = true

[functions.admin-delete-user-v3]
verify_jwt = false

[functions.platform-delete-account]
verify_jwt = false
```

Hinweis: fuer den aktuellen JWT-Gateway-Incident laufen die aktiven Admin-Functions temporaer mit `verify_jwt = false`.

## 5) Secrets anlegen (Pflicht)

Diese zwei Secrets werden von deinem aktuellen Code verwendet:

```bash
npx supabase secrets set --project-ref jgydzxdiwpldgrqkfbfk \
  APP_INVITE_REDIRECT_URL="https://<deine-domain>/auth/accept-invite" \
  APP_PASSWORD_RESET_REDIRECT_URL="https://<deine-domain>/auth/accept-invite"
```

Pruefen:

```bash
npx supabase secrets list --project-ref jgydzxdiwpldgrqkfbfk
```

Hinweis:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` kommen in Functions aus der Supabase Runtime.
- Diese drei Werte setzt man nicht als eigene Custom-Secrets fuer jede Function.

## 6) Functions deployen

```bash
npx supabase functions deploy invite-account-user --project-ref jgydzxdiwpldgrqkfbfk --no-verify-jwt
npx supabase functions deploy platform-provision-account --project-ref jgydzxdiwpldgrqkfbfk --no-verify-jwt
npx supabase functions deploy platform-send-password-reset --project-ref jgydzxdiwpldgrqkfbfk --no-verify-jwt
npx supabase functions deploy admin-delete-user --project-ref jgydzxdiwpldgrqkfbfk
npx supabase functions deploy admin-delete-user-v2 --project-ref jgydzxdiwpldgrqkfbfk
npx supabase functions deploy admin-delete-user-v3 --project-ref jgydzxdiwpldgrqkfbfk --no-verify-jwt
npx supabase functions deploy platform-delete-account --project-ref jgydzxdiwpldgrqkfbfk --no-verify-jwt
```

Pruefen:

```bash
npx supabase functions list --project-ref jgydzxdiwpldgrqkfbfk
```

## 7) Redirect URL im Dashboard freigeben

Supabase Dashboard:
- `Authentication -> URL Configuration`

Allowed Redirect URLs:
- `https://<deine-domain>/auth/accept-invite`

Ohne diesen Schritt funktionieren Einladungs- und Reset-Links nicht sauber.

## 8) Frontend-Aufruf (Beispiel)

```ts
const { data, error } = await supabase.functions.invoke('invite-account-user', {
  body: { accountId, email, role: 'VIEWER' }
});
```

## 9) Smoke-Test mit `curl`

```bash
curl -X POST "https://jgydzxdiwpldgrqkfbfk.functions.supabase.co/invite-account-user" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"<ACCOUNT_UUID>","email":"user@firma.de","role":"VIEWER"}'
```

Erwartung:
- `200 ok=true` bei Erfolg
- `401` ohne Bearer Token
- `403` ohne ausreichende Rolle

## 10) Typische Fehler

- `MISSING_INVITE_REDIRECT_URL`:
  `APP_INVITE_REDIRECT_URL` fehlt.
- `MISSING_PASSWORD_RESET_REDIRECT_URL`:
  `APP_PASSWORD_RESET_REDIRECT_URL` fehlt.
- Redirect-Link kommt nicht an:
  URL nicht in Auth Redirect-Allowlist eingetragen.
