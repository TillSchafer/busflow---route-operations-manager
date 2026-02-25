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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const extractBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const [scheme, token, ...rest] = authHeader.trim().split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value?: string | null): value is string =>
  !!value && UUID_REGEX.test(value);

type MembershipRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';

type UpdateMembershipRoleRequest = {
  accountId?: string;
  membershipId?: string;
  role?: MembershipRole;
  reason?: string;
};

const isValidRole = (value?: string): value is MembershipRole =>
  value === 'ADMIN' || value === 'DISPATCH' || value === 'VIEWER';

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

  let body: UpdateMembershipRoleRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountId = body.accountId?.trim();
  const membershipId = body.membershipId?.trim();
  const reason = body.reason?.trim() || null;
  const nextRole = body.role?.trim().toUpperCase();

  if (!isUuid(accountId) || !isUuid(membershipId) || !isValidRole(nextRole)) {
    return json(400, {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Valid accountId, membershipId and role (ADMIN|DISPATCH|VIEWER) are required.',
    });
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
    const { data: callerMembership, error: callerMembershipError } = await adminClient
      .from('account_memberships')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', caller.id)
      .eq('status', 'ACTIVE')
      .eq('role', 'ADMIN')
      .maybeSingle();

    if (callerMembershipError || !callerMembership) {
      return json(403, { ok: false, code: 'FORBIDDEN' });
    }
  }

  const { data: targetMembership, error: targetMembershipError } = await adminClient
    .from('account_memberships')
    .select('id, account_id, user_id, role, status')
    .eq('id', membershipId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (targetMembershipError) {
    return json(500, { ok: false, code: 'LOOKUP_FAILED', message: targetMembershipError.message });
  }

  if (!targetMembership) {
    return json(404, { ok: false, code: 'MEMBERSHIP_NOT_FOUND' });
  }

  const previousRole = targetMembership.role as MembershipRole;
  if (previousRole === nextRole) {
    return json(200, {
      ok: true,
      accountId,
      membershipId,
      previousRole,
      nextRole,
      unchanged: true,
    });
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from('profiles')
    .select('global_role')
    .eq('id', targetMembership.user_id)
    .maybeSingle();

  if (targetProfileError) {
    return json(500, { ok: false, code: 'LOOKUP_FAILED', message: targetProfileError.message });
  }

  if (!isPlatformAdmin && targetProfile?.global_role === 'ADMIN') {
    return json(403, { ok: false, code: 'FORBIDDEN', message: 'Platform admin memberships can only be changed by platform admins.' });
  }

  if (targetMembership.status === 'ACTIVE' && previousRole === 'ADMIN' && nextRole !== 'ADMIN') {
    const { count: remainingAdmins, error: remainingAdminsError } = await adminClient
      .from('account_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'ACTIVE')
      .eq('role', 'ADMIN')
      .neq('user_id', targetMembership.user_id);

    if (remainingAdminsError) {
      return json(500, { ok: false, code: 'LOOKUP_FAILED', message: remainingAdminsError.message });
    }

    if (!remainingAdmins || remainingAdmins < 1) {
      return json(409, { ok: false, code: 'LAST_ACCOUNT_ADMIN_FORBIDDEN' });
    }
  }

  const { data: updatedMembership, error: updateError } = await adminClient
    .from('account_memberships')
    .update({ role: nextRole })
    .eq('id', membershipId)
    .eq('account_id', accountId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    return json(500, { ok: false, code: 'UPDATE_FAILED', message: updateError.message });
  }

  if (!updatedMembership) {
    return json(404, { ok: false, code: 'MEMBERSHIP_NOT_FOUND' });
  }

  const { error: auditInsertError } = await adminClient
    .from('admin_access_audit')
    .insert({
      admin_user_id: caller.id,
      target_account_id: accountId,
      action: 'MEMBERSHIP_ROLE_UPDATED',
      resource: 'account_memberships',
      resource_id: membershipId,
      meta: {
        target_user_id: targetMembership.user_id,
        previous_role: previousRole,
        next_role: nextRole,
        target_status: targetMembership.status,
        caller_is_platform_admin: isPlatformAdmin,
        reason,
      },
    });

  return json(200, {
    ok: true,
    accountId,
    membershipId,
    previousRole,
    nextRole,
    auditError: auditInsertError?.message || null,
  });
});
