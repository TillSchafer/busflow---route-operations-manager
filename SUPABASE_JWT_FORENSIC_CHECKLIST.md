# Invalid JWT Forensic Checklist

Use this checklist when a function call returns:
`{"code":401,"message":"Invalid JWT"}`

## Incident Note (2026-02-21)
- Observed gateway false-negative JWT validation for admin delete endpoint(s) despite valid token payload in Supabase logs.
- Temporary mitigation in production: `verify_jwt=false` for active admin functions with strict in-function bearer parsing and `auth.getUser(accessToken)` verification.
- After provider fix confirmation, switch back to `verify_jwt=true` incrementally.

## 1) Confirm Browser Request
1. Open DevTools -> Network.
2. Trigger the failing action (e.g. Platform Admin -> "User löschen").
3. Open request `.../admin-delete-user-v3`.
4. Verify:
- URL starts with `https://jgydzxdiwpldgrqkfbfk.supabase.co/functions/v1/`
- `Authorization` header exists and starts with `Bearer `
- Response body and status are captured

Interpretation:
- Missing/empty `Authorization` -> client token flow broken.
- Wrong host -> wrong `VITE_SUPABASE_URL` at runtime.
- Correct host + header but 401 -> stale/invalid session token.

## 2) Validate Session in Browser Console
Run:
```ts
const { data, error } = await supabase.auth.getSession();
console.log({ hasSession: !!data.session, hasToken: !!data.session?.access_token, error });
```

If token exists, decode payload:
```ts
const token = data.session?.access_token ?? '';
const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
console.log(payload);
```

Expected:
- `iss: "https://jgydzxdiwpldgrqkfbfk.supabase.co/auth/v1"` (or supabase issuer format)
- token not expired (`exp`)

## 3) Isolate Gateway vs UI
With current browser `access_token`, call function directly:
```bash
curl -i -X POST "https://jgydzxdiwpldgrqkfbfk.supabase.co/functions/v1/admin-delete-user-v3" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000","accountId":"00000000-0000-0000-0000-000000000000"}'
```

Compare with:
```bash
curl -i -X POST "https://jgydzxdiwpldgrqkfbfk.supabase.co/functions/v1/platform-send-password-reset" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"00000000-0000-0000-0000-000000000000","email":"x@example.com"}'
```

Interpretation:
- Both 401 -> session token invalid.
- Only one 401 -> function-specific path/config issue.
- Curl works, UI fails -> frontend invoke/session state bug.

## 4) Expected Client Behavior (implemented)
- Use `invokeAuthedFunction(...)` from `src/shared/lib/supabaseFunctions.ts`.
- Fetch session token explicitly.
- Retry once with `refreshSession()` on JWT gateway error.
- Show user-facing message:
  `Sitzung ungültig/abgelaufen. Bitte neu anmelden.`
