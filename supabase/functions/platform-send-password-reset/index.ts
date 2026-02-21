import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken, normalizeEmail, isValidEmail, isUuid } from '../_shared/utils.ts';

type ResetRequest = {
  accountId?: string;
  userId?: string;
  email?: string;
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
      return json(500, {
        ok: false,
        code: 'INVALID_PASSWORD_RESET_REDIRECT_URL',
        message: 'APP_PASSWORD_RESET_REDIRECT_URL must start with http:// or https://',
      });
    }
  } catch {
    return json(500, {
      ok: false,
      code: 'INVALID_PASSWORD_RESET_REDIRECT_URL',
      message: 'APP_PASSWORD_RESET_REDIRECT_URL must be a valid URL.',
    });
  }

  try {
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

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('global_role')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfileError || callerProfile?.global_role !== 'ADMIN') {
      return json(403, { ok: false, code: 'FORBIDDEN' });
    }

    let body: ResetRequest;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, code: 'INVALID_JSON' });
    }

    const accountId = getString(body.accountId);
    const requestedUserId = getString(body.userId);
    const rawRequestedEmail = getString(body.email);
    const requestedEmail = rawRequestedEmail ? normalizeEmail(rawRequestedEmail) : '';

    if (!accountId || (!requestedUserId && !requestedEmail)) {
      return json(400, {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'accountId and at least one of userId/email are required.',
      });
    }
    if (!isUuid(accountId)) {
      return json(400, {
        ok: false,
        code: 'INVALID_ACCOUNT_ID',
        message: 'accountId must be a UUID.',
      });
    }
    if (requestedUserId && !isUuid(requestedUserId)) {
      return json(400, {
        ok: false,
        code: 'INVALID_USER_ID',
        message: 'userId must be a UUID.',
      });
    }
    if (requestedEmail && (!isValidEmail(requestedEmail) || requestedEmail.length > 254)) {
      return json(400, {
        ok: false,
        code: 'INVALID_EMAIL',
        message: 'email must be a valid email address.',
      });
    }

    const { data: account, error: accountError } = await adminClient
      .from('platform_accounts')
      .select('id, name')
      .eq('id', accountId)
      .maybeSingle();

    if (accountError) {
      return json(500, { ok: false, code: 'ACCOUNT_LOOKUP_FAILED', message: accountError.message });
    }
    if (!account) {
      return json(404, { ok: false, code: 'ACCOUNT_NOT_FOUND' });
    }

    let resolvedProfile: { id: string; email: string | null } | null = null;

    if (requestedUserId) {
      const { data: profileById, error: profileByIdError } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('id', requestedUserId)
        .maybeSingle();

      if (profileByIdError) {
        return json(500, { ok: false, code: 'PROFILE_LOOKUP_FAILED', message: profileByIdError.message });
      }

      resolvedProfile = profileById;

      if (resolvedProfile?.email && requestedEmail) {
        const normalizedResolvedEmail = normalizeEmail(resolvedProfile.email);
        if (normalizedResolvedEmail !== requestedEmail) {
          return json(409, {
            ok: false,
            code: 'USER_EMAIL_MISMATCH',
            message: 'Provided userId does not match provided email.',
          });
        }
      } else if (requestedEmail && !resolvedProfile?.email) {
        return json(409, {
          ok: false,
          code: 'USER_EMAIL_MISMATCH',
          message: 'Provided userId does not have the provided email.',
        });
      }
    } else if (requestedEmail) {
      const { data: profileByEmail, error: profileByEmailError } = await adminClient
        .from('profiles')
        .select('id, email')
        .ilike('email', requestedEmail)
        .maybeSingle();

      if (profileByEmailError) {
        return json(500, { ok: false, code: 'PROFILE_LOOKUP_FAILED', message: profileByEmailError.message });
      }

      resolvedProfile = profileByEmail;
    }

    let membershipFound = false;
    if (resolvedProfile?.id) {
      const { data: membership, error: membershipError } = await adminClient
        .from('account_memberships')
        .select('id')
        .eq('account_id', accountId)
        .eq('user_id', resolvedProfile.id)
        .in('status', ['ACTIVE', 'INVITED'])
        .maybeSingle();

      if (membershipError) {
        return json(500, { ok: false, code: 'MEMBERSHIP_LOOKUP_FAILED', message: membershipError.message });
      }

      membershipFound = !!membership?.id;
    }

    let resetErrorMessage: string | null = null;
    const resolvedEmail = resolvedProfile?.email ? normalizeEmail(resolvedProfile.email) : null;

    if (membershipFound && resolvedEmail) {
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(resolvedEmail, {
        redirectTo: resetRedirect,
      });
      if (resetError) {
        resetErrorMessage = resetError.message;
      }
    }

    const { error: auditInsertError } = await adminClient
      .from('admin_access_audit')
      .insert({
        admin_user_id: caller.id,
        target_account_id: accountId,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'profiles',
        resource_id: resolvedProfile?.id || null,
        meta: {
          requested_user_id: requestedUserId || null,
          requested_email: requestedEmail || null,
          resolved_user_id: resolvedProfile?.id || null,
          resolved_email: resolvedEmail,
          account_name: account.name,
          membership_found: membershipFound,
          reset_error: resetErrorMessage,
        },
      });

    const auditError = auditInsertError?.message || null;

    if (resetErrorMessage) {
      return json(202, {
        ok: true,
        code: 'RESET_ACCEPTED_EMAIL_FAILED',
        message: resetErrorMessage,
        auditError,
      });
    }

    // Deliberately neutral response to avoid user enumeration.
    return json(200, {
      ok: true,
      code: 'RESET_REQUEST_ACCEPTED',
      message: 'If a matching user exists, a reset link has been sent.',
      auditError,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      code: 'RESET_FAILED',
      message: error instanceof Error ? error.message : 'Unexpected reset error.',
    });
  }
});
