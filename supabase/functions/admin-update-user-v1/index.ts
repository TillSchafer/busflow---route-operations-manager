import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken, isUuid, normalizeEmail, isValidEmail } from '../_shared/utils.ts';

type UpdateUserRequest = {
  accountId?: string;
  userId?: string;
  fullName?: string;
  email?: string;
  password?: string;
  reason?: string;
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

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
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

  let body: UpdateUserRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountId = getString(body.accountId);
  const userId = getString(body.userId);
  const reason = getString(body.reason) || null;

  const fullNameProvided = Object.prototype.hasOwnProperty.call(body, 'fullName');
  const emailProvided = Object.prototype.hasOwnProperty.call(body, 'email');
  const passwordProvided = Object.prototype.hasOwnProperty.call(body, 'password');

  const fullName = getString(body.fullName);
  const emailRaw = getString(body.email);
  const password = getString(body.password);
  const normalizedEmail = emailRaw ? normalizeEmail(emailRaw) : '';

  if (!isUuid(accountId) || !isUuid(userId)) {
    return json(400, { ok: false, code: 'INVALID_INPUT', message: 'Valid accountId and userId are required.' });
  }

  if (!fullNameProvided && !emailProvided && !passwordProvided) {
    return json(400, { ok: false, code: 'NOTHING_TO_UPDATE' });
  }

  if (emailProvided) {
    if (!normalizedEmail || !isValidEmail(normalizedEmail) || normalizedEmail.length > 254) {
      return json(400, { ok: false, code: 'INVALID_EMAIL' });
    }
  }

  if (passwordProvided) {
    if (!password || password.length < 8) {
      return json(400, { ok: false, code: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters.' });
    }
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('global_role')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfileError || !callerProfile) {
    return json(403, { ok: false, code: 'FORBIDDEN' });
  }

  const isPlatformAdmin = callerProfile.global_role === 'ADMIN';
  if (!isPlatformAdmin) {
    const { data: callerMembership } = await adminClient
      .from('account_memberships')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', caller.id)
      .eq('status', 'ACTIVE')
      .eq('role', 'ADMIN')
      .maybeSingle();

    if (!callerMembership) {
      return json(403, { ok: false, code: 'FORBIDDEN' });
    }
  }

  const { data: targetMembership, error: targetMembershipError } = await adminClient
    .from('account_memberships')
    .select('id, status')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (targetMembershipError) {
    return json(500, { ok: false, code: 'USER_SCOPE_CHECK_FAILED', message: targetMembershipError.message });
  }

  if (!targetMembership) {
    return json(404, { ok: false, code: 'USER_NOT_IN_ACCOUNT' });
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (targetProfileError) {
    return json(500, { ok: false, code: 'PROFILE_LOOKUP_FAILED', message: targetProfileError.message });
  }

  if (!targetProfile) {
    return json(404, { ok: false, code: 'USER_NOT_FOUND' });
  }

  if (emailProvided) {
    const { data: duplicateProfile, error: duplicateProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .neq('id', userId)
      .maybeSingle();

    if (duplicateProfileError) {
      return json(500, { ok: false, code: 'EMAIL_CHECK_FAILED', message: duplicateProfileError.message });
    }

    if (duplicateProfile) {
      return json(409, { ok: false, code: 'EMAIL_ALREADY_IN_USE' });
    }
  }

  if (fullNameProvided || emailProvided) {
    const profileUpdatePayload: Record<string, string | null> = {};
    if (fullNameProvided) {
      profileUpdatePayload.full_name = fullName || null;
    }
    if (emailProvided) {
      profileUpdatePayload.email = normalizedEmail;
    }

    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update(profileUpdatePayload)
      .eq('id', userId);

    if (profileUpdateError) {
      return json(500, { ok: false, code: 'PROFILE_UPDATE_FAILED', message: profileUpdateError.message });
    }
  }

  if (emailProvided || passwordProvided) {
    const authUpdatePayload: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (emailProvided) {
      authUpdatePayload.email = normalizedEmail;
      authUpdatePayload.email_confirm = true;
    }
    if (passwordProvided) {
      authUpdatePayload.password = password;
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, authUpdatePayload);
    if (authUpdateError) {
      return json(500, { ok: false, code: 'AUTH_UPDATE_FAILED', message: authUpdateError.message });
    }
  }

  const { error: auditInsertError } = await adminClient
    .from('admin_access_audit')
    .insert({
      admin_user_id: caller.id,
      target_account_id: accountId,
      action: 'USER_UPDATED',
      resource: 'profiles',
      resource_id: userId,
      meta: {
        reason,
        changed_full_name: fullNameProvided,
        changed_email: emailProvided,
        changed_password: passwordProvided,
        target_membership_status: targetMembership.status,
      },
    });

  return json(200, {
    ok: true,
    updatedUserId: userId,
    auditError: auditInsertError?.message || null,
  });
});
