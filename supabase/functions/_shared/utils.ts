// Shared utilities for all Supabase Edge Functions.
// Import with: import { corsHeaders, json, extractBearerToken, ... } from '../_shared/utils.ts';

// CORS policy decision (documented 2026-02-28):
// Access-Control-Allow-Origin: * (wildcard) is intentional for all functions.
//
// Authenticated functions (verify_jwt or internal auth.getUser check):
//   Wildcard is safe — Bearer tokens are sent explicitly, not via cookies.
//   A cross-origin attacker cannot obtain or forward a valid Bearer token via CORS.
//
// Public function (public-register-trial-v1, no auth required):
//   Wildcard means any browser-based origin can trigger trial registrations.
//   Accepted trade-off: the endpoint is intentionally public (self-signup).
//   Protection layers in place: IP-based rate limiting (5/h), email-based rate
//   limiting (3/h), Supabase advisory lock against race conditions, honeypot field.
//   Note: restricting origin here would not prevent curl/API abuse — only browser-CSRF.
//   Revisit if abuse patterns emerge (tighten to known app domain at that point).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

export const extractBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const [scheme, token, ...rest] = authHeader.trim().split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
};

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value?: string | null): value is string =>
  !!value && UUID_REGEX.test(value);

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
