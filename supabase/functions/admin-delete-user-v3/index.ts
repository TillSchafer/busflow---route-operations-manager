import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken, isUuid } from '../_shared/utils.ts';

type DeleteUserRequest = {
  userId?: string;
  accountId?: string;
  reason?: string;
};

const revokePendingInvitationsByEmail = async (
  adminClient: ReturnType<typeof createClient>,
  userEmail?: string | null
) => {
  if (!userEmail) return null;
  const { error } = await adminClient
    .from('account_invitations')
    .update({ status: 'REVOKED' })
    .eq('status', 'PENDING')
    .ilike('email', userEmail);

  if (error) {
    throw new Error(`pending invitation cleanup failed: ${error.message}`);
  }

  return null;
};

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

  let body: DeleteUserRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const userId = body.userId?.trim();
  const accountId = body.accountId?.trim();
  const reason = body.reason?.trim() || null;

  if (!isUuid(userId)) {
    return json(400, { ok: false, code: 'INVALID_INPUT', message: 'Valid userId is required.' });
  }
  if (accountId && !isUuid(accountId)) {
    return json(400, { ok: false, code: 'INVALID_INPUT', message: 'accountId must be a UUID.' });
  }
  if (caller.id === userId) {
    return json(409, { ok: false, code: 'SELF_DELETE_FORBIDDEN' });
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
    if (!isUuid(accountId)) {
      return json(400, { ok: false, code: 'ACCOUNT_REQUIRED' });
    }

    const { data: callerMembership, error: callerMembershipError } = await adminClient
      .from('account_memberships')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', caller.id)
      .eq('status', 'ACTIVE')
      .eq('role', 'ADMIN')
      .maybeSingle();

    if (callerMembershipError) {
      return json(500, { ok: false, code: 'LOOKUP_FAILED', message: callerMembershipError.message });
    }

    if (!callerMembership) {
      return json(403, { ok: false, code: 'FORBIDDEN' });
    }
  }

  const { data: authLookup, error: authLookupError } = await adminClient.auth.admin.getUserById(userId);
  if (authLookupError || !authLookup?.user) {
    return json(404, { ok: false, code: 'USER_NOT_FOUND' });
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from('profiles')
    .select('id, email, global_role')
    .eq('id', userId)
    .maybeSingle();

  if (targetProfileError) {
    return json(500, { ok: false, code: 'LOOKUP_FAILED', message: targetProfileError.message });
  }

  const targetEmail = targetProfile?.email || authLookup.user.email || null;
  const targetGlobalRole = targetProfile?.global_role || null;

  if (targetGlobalRole === 'ADMIN') {
    if (!isPlatformAdmin) {
      return json(403, { ok: false, code: 'FORBIDDEN' });
    }

    const { count: remainingAdmins, error: remainingAdminsError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('global_role', 'ADMIN')
      .neq('id', userId);

    if (remainingAdminsError) {
      return json(500, { ok: false, code: 'LOOKUP_FAILED', message: remainingAdminsError.message });
    }

    if (!remainingAdmins || remainingAdmins < 1) {
      return json(409, { ok: false, code: 'LAST_PLATFORM_ADMIN_FORBIDDEN' });
    }
  }

  let auditAccountId: string | null = isUuid(accountId) ? accountId : null;

  if (isUuid(accountId)) {
    const { data: targetMembership, error: targetMembershipError } = await adminClient
      .from('account_memberships')
      .select('account_id, role, status')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .maybeSingle();

    if (targetMembershipError) {
      return json(500, { ok: false, code: 'LOOKUP_FAILED', message: targetMembershipError.message });
    }

    if (!targetMembership && !isPlatformAdmin) {
      return json(403, { ok: false, code: 'USER_SCOPE_VIOLATION' });
    }

    if (!isPlatformAdmin && targetMembership?.role === 'ADMIN' && targetMembership.status === 'ACTIVE') {
      const { count: remainingAccountAdmins, error: remainingAccountAdminsError } = await adminClient
        .from('account_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('status', 'ACTIVE')
        .eq('role', 'ADMIN')
        .neq('user_id', userId);

      if (remainingAccountAdminsError) {
        return json(500, { ok: false, code: 'LOOKUP_FAILED', message: remainingAccountAdminsError.message });
      }

      if (!remainingAccountAdmins || remainingAccountAdmins < 1) {
        return json(409, { ok: false, code: 'LAST_ACCOUNT_ADMIN_FORBIDDEN' });
      }
    }
  } else {
    const { data: anyMembership, error: anyMembershipError } = await adminClient
      .from('account_memberships')
      .select('account_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (anyMembershipError) {
      return json(500, { ok: false, code: 'LOOKUP_FAILED', message: anyMembershipError.message });
    }

    auditAccountId = anyMembership?.account_id || null;
  }

  try {
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return json(500, { ok: false, code: 'DELETE_FAILED', message: authDeleteError.message });
    }

    const cleanupWarnings: string[] = [];
    try {
      await revokePendingInvitationsByEmail(adminClient, targetEmail);
    } catch (cleanupError) {
      cleanupWarnings.push(cleanupError instanceof Error ? cleanupError.message : 'Unexpected invitation cleanup error.');
    }

    const { error: auditInsertError } = await adminClient
      .from('admin_access_audit')
      .insert({
        admin_user_id: caller.id,
        target_account_id: auditAccountId,
        action: 'USER_HARD_DELETED',
        resource: 'profiles',
        resource_id: userId,
        meta: {
          reason,
          requested_account_id: accountId || null,
          caller_is_platform_admin: isPlatformAdmin,
          cleanup_warnings: cleanupWarnings,
        },
      });

    return json(200, {
      ok: true,
      deletedUserId: userId,
      auditError: auditInsertError?.message || null,
      cleanupWarnings,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      code: 'DELETE_FAILED',
      message: error instanceof Error ? error.message : 'Unexpected delete error.',
    });
  }
});
