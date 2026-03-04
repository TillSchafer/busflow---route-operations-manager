import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, normalizeEmail, isValidEmail } from '../_shared/utils.ts';

// Rate limit: one code request per email per COOLDOWN_SECONDS.
// The frontend enforces a matching UI countdown — this is the server-side guard.
const COOLDOWN_SECONDS = 60;
const MAX_EMAIL_LENGTH = 254;

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

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const rawEmail = (body.email || '').trim().slice(0, MAX_EMAIL_LENGTH);
  const email = rawEmail ? normalizeEmail(rawEmail) : '';

  if (!email || !isValidEmail(email)) {
    return json(400, { ok: false, code: 'INVALID_EMAIL' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Check for a valid PENDING invitation for this email.
  const { data: invitation, error: invitationError } = await adminClient
    .from('account_invitations')
    .select('id, meta, expires_at')
    .ilike('email', email)
    .eq('status', 'PENDING')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (invitationError) {
    return json(500, { ok: false, code: 'LOOKUP_FAILED' });
  }

  if (!invitation) {
    return json(404, { ok: false, code: 'NO_PENDING_INVITATION', message: 'Keine offene Einladung für diese E-Mail-Adresse gefunden.' });
  }

  // Enforce server-side cooldown.
  const lastRequestedAt: string | undefined = invitation.meta?.otp_last_requested_at;
  if (lastRequestedAt) {
    const secondsElapsed = (Date.now() - new Date(lastRequestedAt).getTime()) / 1000;
    if (secondsElapsed < COOLDOWN_SECONDS) {
      const secondsRemaining = Math.ceil(COOLDOWN_SECONDS - secondsElapsed);
      return json(429, {
        ok: false,
        code: 'RATE_LIMITED',
        message: `Bitte warten Sie noch ${secondsRemaining} Sekunden, bevor Sie einen neuen Code anfordern.`,
        secondsRemaining,
      });
    }
  }

  // Update otp_last_requested_at before sending to prevent parallel requests.
  const { error: updateError } = await adminClient
    .from('account_invitations')
    .update({
      meta: {
        ...(invitation.meta || {}),
        otp_last_requested_at: new Date().toISOString(),
      },
    })
    .eq('id', invitation.id)
    .eq('status', 'PENDING');

  if (updateError) {
    return json(500, { ok: false, code: 'UPDATE_FAILED' });
  }

  // Send OTP via Supabase. Uses the Magic Link email template (shows {{ .Token }}).
  const anonClient = createClient(supabaseUrl, anonKey);
  const { error: otpError } = await anonClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (otpError) {
    // Revert otp_last_requested_at so the user can retry immediately.
    await adminClient
      .from('account_invitations')
      .update({
        meta: {
          ...(invitation.meta || {}),
          otp_last_requested_at: lastRequestedAt ?? null,
        },
      })
      .eq('id', invitation.id);

    return json(500, {
      ok: false,
      code: 'OTP_SEND_FAILED',
      message: 'Code konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
    });
  }

  return json(200, { ok: true, code: 'OTP_SENT' });
});
