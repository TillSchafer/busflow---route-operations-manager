import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ResetRequest = {
  accountId?: string;
  email?: string;
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
  const resetRedirect = Deno.env.get('APP_PASSWORD_RESET_REDIRECT_URL')?.trim();

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
  }

  if (!resetRedirect) {
    return json(500, {
      ok: false,
      code: 'MISSING_PASSWORD_RESET_REDIRECT_URL',
      message: 'APP_PASSWORD_RESET_REDIRECT_URL is required.',
    });
  }

  try {
    const parsed = new URL(resetRedirect);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return json(500, { ok: false, code: 'INVALID_PASSWORD_RESET_REDIRECT_URL' });
    }
  } catch {
    return json(500, { ok: false, code: 'INVALID_PASSWORD_RESET_REDIRECT_URL' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return json(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('global_role')
    .eq('id', caller.id)
    .single();

  if (callerProfileError || callerProfile?.global_role !== 'ADMIN') {
    return json(403, { ok: false, code: 'FORBIDDEN' });
  }

  let body: ResetRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountId = body.accountId?.trim() || '';
  const email = body.email ? normalizeEmail(body.email) : '';

  if (!accountId || !email) {
    return json(400, { ok: false, code: 'INVALID_INPUT', message: 'accountId and email are required.' });
  }
  if (!isValidEmail(email) || email.length > 254) {
    return json(400, { ok: false, code: 'INVALID_EMAIL' });
  }

  const { data: account, error: accountError } = await adminClient
    .from('platform_accounts')
    .select('id, name')
    .eq('id', accountId)
    .maybeSingle();

  if (accountError || !account) {
    return json(404, { ok: false, code: 'ACCOUNT_NOT_FOUND' });
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle();

  let membershipFound = false;
  if (profile?.id) {
    const { data: membership } = await adminClient
      .from('account_memberships')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', profile.id)
      .in('status', ['ACTIVE', 'INVITED'])
      .maybeSingle();

    membershipFound = !!membership?.id;
  }

  let resetErrorMessage: string | null = null;
  if (membershipFound) {
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirect,
    });
    if (resetError) {
      resetErrorMessage = resetError.message;
    }
  }

  await adminClient
    .from('admin_access_audit')
    .insert({
      admin_user_id: caller.id,
      target_account_id: accountId,
      action: 'PASSWORD_RESET_REQUESTED',
      resource: 'profiles',
      resource_id: profile?.id || null,
      meta: {
        email,
        account_name: account.name,
        membership_found: membershipFound,
        reset_error: resetErrorMessage,
      },
    });

  if (resetErrorMessage) {
    return json(202, {
      ok: true,
      code: 'RESET_ACCEPTED_EMAIL_FAILED',
      message: resetErrorMessage,
    });
  }

  // Deliberately neutral response to avoid user enumeration.
  return json(200, {
    ok: true,
    code: 'RESET_REQUEST_ACCEPTED',
    message: 'If a matching user exists, a reset link has been sent.',
  });
});
