import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DeleteUserRequest = {
  userId?: string;
  accountId?: string;
  reason?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const isUuid = (value?: string | null): value is string => !!value && UUID_REGEX.test(value);
const extractBearerToken = (authHeader: string | null) => {
  if (!authHeader) return null;
  const [scheme, token, ...rest] = authHeader.trim().split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
};

const cleanupUserReferences = async (adminClient: ReturnType<typeof createClient>, userId: string, userEmail?: string | null) => {
  await adminClient.from('platform_accounts').update({ created_by: null }).eq('created_by', userId);
  await adminClient.from('platform_accounts').update({ archived_by: null }).eq('archived_by', userId);
  await adminClient.from('account_invitations').update({ invited_by: null }).eq('invited_by', userId);

  if (userEmail) {
    await adminClient
      .from('account_invitations')
      .update({ status: 'REVOKED' })
      .eq('status', 'PENDING')
      .ilike('email', userEmail);
  }
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

  const { data: authLookup, error: authLookupError } = await adminClient.auth.admin.getUserById(userId);
  if (authLookupError || !authLookup?.user) {
    return json(404, { ok: false, code: 'USER_NOT_FOUND' });
  }

  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('id, email, global_role')
    .eq('id', userId)
    .maybeSingle();

  const targetEmail = targetProfile?.email || authLookup.user.email || null;
  const targetGlobalRole = targetProfile?.global_role || null;

  if (targetGlobalRole === 'ADMIN') {
    if (!isPlatformAdmin) {
      return json(403, { ok: false, code: 'FORBIDDEN' });
    }

    const { count: remainingAdmins } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('global_role', 'ADMIN')
      .neq('id', userId);

    if (!remainingAdmins || remainingAdmins < 1) {
      return json(409, { ok: false, code: 'LAST_PLATFORM_ADMIN_FORBIDDEN' });
    }
  }

  let auditAccountId: string | null = isUuid(accountId) ? accountId : null;

  if (isUuid(accountId)) {
    const { data: targetMembership } = await adminClient
      .from('account_memberships')
      .select('account_id, role, status')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!targetMembership && !isPlatformAdmin) {
      return json(403, { ok: false, code: 'USER_SCOPE_VIOLATION' });
    }

    if (!isPlatformAdmin && targetMembership?.role === 'ADMIN' && targetMembership.status === 'ACTIVE') {
      const { count: remainingAccountAdmins } = await adminClient
        .from('account_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('status', 'ACTIVE')
        .eq('role', 'ADMIN')
        .neq('user_id', userId);

      if (!remainingAccountAdmins || remainingAccountAdmins < 1) {
        return json(409, { ok: false, code: 'LAST_ACCOUNT_ADMIN_FORBIDDEN' });
      }
    }
  } else {
    const { data: anyMembership } = await adminClient
      .from('account_memberships')
      .select('account_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    auditAccountId = anyMembership?.account_id || null;
  }

  try {
    await cleanupUserReferences(adminClient, userId, targetEmail);
    await adminClient.from('app_permissions').delete().eq('user_id', userId);
    await adminClient.from('account_memberships').delete().eq('user_id', userId);

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return json(500, { ok: false, code: 'DELETE_FAILED', message: authDeleteError.message });
    }

    await adminClient
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
        },
      });

    return json(200, {
      ok: true,
      deletedUserId: userId,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      code: 'DELETE_FAILED',
      message: error instanceof Error ? error.message : 'Unexpected delete error.',
    });
  }
});
