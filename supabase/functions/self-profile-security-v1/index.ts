import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken, normalizeEmail, isValidEmail } from '../_shared/utils.ts';

type RequestBody = {
  action?: string;
  newEmail?: string;
};

const getString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const securityRedirectUrl = Deno.env.get('APP_ACCOUNT_SECURITY_REDIRECT_URL')?.trim();
  const ownerEmail = Deno.env.get('PLATFORM_OWNER_EMAIL')?.trim().toLowerCase();

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
  }

  if (!securityRedirectUrl) {
    return json(500, {
      ok: false,
      code: 'MISSING_REDIRECT_URL',
      message: 'APP_ACCOUNT_SECURITY_REDIRECT_URL is required.',
    });
  }

  const accessToken = extractBearerToken(req.headers.get('Authorization'));
  if (!accessToken) {
    return json(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerClient = createClient(supabaseUrl, anonKey);

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser(accessToken);

  if (callerError || !caller) {
    return json(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const action = getString(body.action);

  // --- REQUEST_EMAIL_CHANGE ---
  if (action === 'REQUEST_EMAIL_CHANGE') {
    const newEmailRaw = getString(body.newEmail);
    const newEmail = newEmailRaw ? normalizeEmail(newEmailRaw) : '';

    if (!newEmail || !isValidEmail(newEmail) || newEmail.length > 254) {
      return json(400, { ok: false, code: 'INVALID_EMAIL', message: 'A valid new email address is required.' });
    }

    const currentEmail = caller.email ? normalizeEmail(caller.email) : '';
    if (currentEmail && currentEmail === newEmail) {
      return json(400, { ok: false, code: 'EMAIL_SAME', message: 'New email must be different from current email.' });
    }

    // Platform owner cannot change email via self-service (VITE_PLATFORM_OWNER_EMAIL lock)
    if (ownerEmail && currentEmail === ownerEmail) {
      return json(403, {
        ok: false,
        code: 'OWNER_EMAIL_CHANGE_BLOCKED',
        message: 'Die E-Mail des Platform-Owners kann nicht per Self-Service geändert werden.',
      });
    }

    // Check for duplicate email in profiles
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', newEmail)
      .neq('id', caller.id)
      .maybeSingle();

    if (existingProfile) {
      return json(409, { ok: false, code: 'EMAIL_ALREADY_IN_USE', message: 'Diese E-Mail-Adresse wird bereits verwendet.' });
    }

    // Trigger email-change confirmation flow via the user's own session
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });

    const { error: updateError } = await userClient.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: securityRedirectUrl }
    );

    if (updateError) {
      return json(500, {
        ok: false,
        code: 'EMAIL_CHANGE_FAILED',
        message: updateError.message,
      });
    }

    return json(200, { ok: true, code: 'EMAIL_CHANGE_REQUESTED', message: 'Bestätigungs-E-Mail wurde gesendet.' });
  }

  // --- REQUEST_PASSWORD_RESET ---
  if (action === 'REQUEST_PASSWORD_RESET') {
    const callerEmail = caller.email;
    if (!callerEmail) {
      return json(400, { ok: false, code: 'NO_EMAIL', message: 'Kein E-Mail-Adresse für diesen Benutzer gefunden.' });
    }

    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(callerEmail, {
      redirectTo: securityRedirectUrl,
    });

    if (resetError) {
      return json(500, { ok: false, code: 'PASSWORD_RESET_FAILED', message: resetError.message });
    }

    return json(200, { ok: true, code: 'PASSWORD_RESET_REQUESTED', message: 'Reset-Link wurde an Ihre E-Mail gesendet.' });
  }

  return json(400, { ok: false, code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` });
});
