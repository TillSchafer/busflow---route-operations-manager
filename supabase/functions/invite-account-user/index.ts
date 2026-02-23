import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type InviteRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';

type InviteRequest = {
  accountId?: string;
  email?: string;
  role?: InviteRole;
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
const INVITE_REDIRECT_PATH = '/auth/accept-invite';

const normalizePathname = (pathname: string) => {
  if (!pathname) return '/';
  const normalized = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return normalized || '/';
};

const extractBearerToken = (authHeader: string | null) => {
  if (!authHeader) return null;
  const [scheme, token, ...rest] = authHeader.trim().split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
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

  const redirectTo = Deno.env.get('APP_INVITE_REDIRECT_URL')?.trim();
  if (!redirectTo) {
    return json(500, {
      ok: false,
      code: 'MISSING_INVITE_REDIRECT_URL',
      message: 'APP_INVITE_REDIRECT_URL is required and must point to /auth/accept-invite.',
    });
  }

  try {
    const parsed = new URL(redirectTo);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return json(500, {
        ok: false,
        code: 'INVALID_INVITE_REDIRECT_URL',
        message: 'APP_INVITE_REDIRECT_URL must start with http:// or https://',
        meta: { redirectTo },
      });
    }
    if (normalizePathname(parsed.pathname) !== INVITE_REDIRECT_PATH) {
      return json(500, {
        ok: false,
        code: 'INVALID_INVITE_REDIRECT_PATH',
        message: `APP_INVITE_REDIRECT_URL must use path ${INVITE_REDIRECT_PATH}.`,
        meta: { redirectTo, expectedPath: INVITE_REDIRECT_PATH },
      });
    }
  } catch {
    return json(500, { ok: false, code: 'INVALID_INVITE_REDIRECT_URL' });
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

  let body: InviteRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountId = body.accountId?.trim();
  const email = body.email ? normalizeEmail(body.email) : '';
  const role: InviteRole = body.role ?? 'VIEWER';

  if (!accountId || !email) {
    return json(400, { ok: false, code: 'INVALID_INPUT', message: 'accountId und email sind erforderlich.' });
  }
  if (!isValidEmail(email) || email.length > 254) {
    return json(400, { ok: false, code: 'INVALID_EMAIL' });
  }

  if (!['ADMIN', 'DISPATCH', 'VIEWER'].includes(role)) {
    return json(400, { ok: false, code: 'INVALID_ROLE' });
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('global_role')
    .eq('id', caller.id)
    .single();

  if (callerProfileError) {
    return json(403, { ok: false, code: 'PROFILE_NOT_FOUND' });
  }

  const isPlatformAdmin = callerProfile.global_role === 'ADMIN';
  if (!isPlatformAdmin) {
    const { data: membership, error: membershipError } = await adminClient
      .from('account_memberships')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', caller.id)
      .eq('status', 'ACTIVE')
      .eq('role', 'ADMIN')
      .maybeSingle();

    if (membershipError || !membership) {
      return json(403, { ok: false, code: 'FORBIDDEN' });
    }
  }

  const { data: account, error: accountError } = await adminClient
    .from('platform_accounts')
    .select('id, name')
    .eq('id', accountId)
    .maybeSingle();

  if (accountError || !account) {
    return json(404, { ok: false, code: 'ACCOUNT_NOT_FOUND' });
  }

  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfile?.id) {
    const { data: existingMembership } = await adminClient
      .from('account_memberships')
      .select('id, account_id')
      .eq('user_id', existingProfile.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existingMembership?.id && existingMembership.account_id === accountId) {
      return json(409, { ok: false, code: 'USER_ALREADY_ACTIVE_IN_ACCOUNT' });
    }

    if (existingMembership?.id && existingMembership.account_id !== accountId) {
      return json(409, { ok: false, code: 'USER_ALREADY_ACTIVE_IN_ANOTHER_ACCOUNT' });
    }
  }

  const { data: pendingInvitation } = await adminClient
    .from('account_invitations')
    .select('id')
    .eq('account_id', accountId)
    .eq('status', 'PENDING')
    .ilike('email', email)
    .maybeSingle();

  if (pendingInvitation?.id) {
    return json(409, { ok: false, code: 'INVITE_ALREADY_PENDING' });
  }

  const { data: invitation, error: invitationError } = await adminClient
    .from('account_invitations')
    .insert({
      account_id: accountId,
      email,
      role,
      status: 'PENDING',
      invited_by: caller.id,
      meta: {
        source: 'invite-account-user',
      },
    })
    .select('id')
    .single();

  if (invitationError || !invitation) {
    return json(500, { ok: false, code: 'INVITE_CREATE_FAILED', message: invitationError?.message });
  }

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      invited_account_id: accountId,
      invited_role: role,
    },
    redirectTo,
  });

  if (inviteError) {
    return json(200, {
      ok: true,
      emailSent: false,
      code: 'INVITATION_CREATED_EMAIL_FAILED',
      invitationId: invitation.id,
      accountName: account.name,
    });
  }

  return json(200, {
    ok: true,
    emailSent: true,
    invitationId: invitation.id,
    accountName: account.name,
  });
});
