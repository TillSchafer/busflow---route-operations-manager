import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  INVITE_BLOCKER_CONFIRMED_USER,
  getInvitationTargetState,
  deleteGhostUserIfSafe,
} from '../_shared/inviteAuth.ts';

type InviteRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';

type InviteRequest = {
  accountId?: string;
  email?: string;
  role?: InviteRole;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const ACCEPT_INVITE_PATH = '/auth/accept-invite';

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { ok: false, code: 'MISSING_SUPABASE_ENV' });
  }

  // APP_INVITE_REDIRECT_URL is still required for Supabase's inviteUserByEmail call,
  // but the email template no longer renders {{ .ConfirmationURL }} — instead it uses
  // {{ .Data.accept_invite_url }} which is a plain link without a token.
  const redirectTo = Deno.env.get('APP_INVITE_REDIRECT_URL')?.trim();
  if (!redirectTo) {
    return json(500, { ok: false, code: 'MISSING_INVITE_REDIRECT_URL' });
  }

  try {
    const parsed = new URL(redirectTo);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return json(500, { ok: false, code: 'INVALID_INVITE_REDIRECT_URL' });
    }
    if (normalizePathname(parsed.pathname) !== ACCEPT_INVITE_PATH) {
      return json(500, {
        ok: false,
        code: 'INVALID_INVITE_REDIRECT_PATH',
        message: `APP_INVITE_REDIRECT_URL must use path ${ACCEPT_INVITE_PATH}.`,
      });
    }
  } catch {
    return json(500, { ok: false, code: 'INVALID_INVITE_REDIRECT_URL' });
  }

  const accessToken = extractBearerToken(req.headers.get('Authorization'));
  if (!accessToken) return json(401, { ok: false, code: 'UNAUTHORIZED' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerClient = createClient(supabaseUrl, anonKey);

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(accessToken);
  if (callerError || !caller) return json(401, { ok: false, code: 'UNAUTHORIZED' });

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
  if (!isValidEmail(email) || email.length > 254) return json(400, { ok: false, code: 'INVALID_EMAIL' });
  if (!['ADMIN', 'DISPATCH', 'VIEWER'].includes(role)) return json(400, { ok: false, code: 'INVALID_ROLE' });

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles').select('global_role').eq('id', caller.id).single();
  if (callerProfileError) return json(403, { ok: false, code: 'PROFILE_NOT_FOUND' });

  const isPlatformAdmin = callerProfile.global_role === 'ADMIN';
  if (!isPlatformAdmin) {
    const { data: membership, error: membershipError } = await adminClient
      .from('account_memberships').select('id')
      .eq('account_id', accountId).eq('user_id', caller.id).eq('status', 'ACTIVE').eq('role', 'ADMIN')
      .maybeSingle();
    if (membershipError || !membership) return json(403, { ok: false, code: 'FORBIDDEN' });
  }

  const { data: account, error: accountError } = await adminClient
    .from('platform_accounts').select('id, name').eq('id', accountId).maybeSingle();
  if (accountError || !account) return json(404, { ok: false, code: 'ACCOUNT_NOT_FOUND' });

  let targetState;
  try {
    targetState = await getInvitationTargetState(adminClient, email);
  } catch (error) {
    return json(500, { ok: false, code: 'LOOKUP_FAILED', message: error instanceof Error ? error.message : 'lookup failed' });
  }

  if (targetState.activeMembershipCount > 0) {
    if (targetState.activeMembershipAccountId === accountId) {
      return json(409, { ok: false, code: 'USER_ALREADY_ACTIVE_IN_ACCOUNT' });
    }
    return json(409, { ok: false, code: 'USER_ALREADY_ACTIVE_IN_ANOTHER_ACCOUNT' });
  }

  if (targetState.isEmailConfirmed) {
    return json(409, {
      ok: false,
      code: INVITE_BLOCKER_CONFIRMED_USER,
      message: 'Diese E-Mail ist bereits registriert. Bitte Login oder Passwort-Reset nutzen.',
    });
  }

  // Check for existing pending invitation
  const { data: pendingInvitation } = await adminClient
    .from('account_invitations').select('id, expires_at')
    .eq('account_id', accountId).eq('status', 'PENDING').ilike('email', email).maybeSingle();

  if (pendingInvitation?.id) {
    const isExpired = pendingInvitation.expires_at
      ? new Date(pendingInvitation.expires_at) < new Date() : false;
    if (!isExpired) return json(409, { ok: false, code: 'INVITE_ALREADY_PENDING' });

    await adminClient.from('account_invitations').update({
      status: 'REVOKED',
      meta: { auto_revoked_reason: 'expired_on_reinvite', auto_revoked_at: new Date().toISOString() },
    }).eq('id', pendingInvitation.id);
  }

  // Clean up ghost user if present (unconfirmed user with no membership)
  if (targetState.canDeleteGhostUser) {
    try {
      await deleteGhostUserIfSafe(adminClient, targetState);
    } catch {
      // Non-fatal: inviteUserByEmail will handle it
    }
  }

  // Create invitation record (no invite_code_hash — OTP flow handles verification)
  const { data: invitation, error: invitationError } = await adminClient
    .from('account_invitations').insert({
      account_id: accountId,
      email,
      role,
      status: 'PENDING',
      invited_by: caller.id,
      meta: { source: 'invite-account-user' },
    }).select('id').single();

  if (invitationError || !invitation) {
    return json(500, { ok: false, code: 'INVITE_CREATE_FAILED', message: invitationError?.message });
  }

  // Build the plain accept-invite URL (no token — user will request OTP on the page)
  const appBaseUrl = new URL(redirectTo).origin;
  const acceptInviteUrl = `${appBaseUrl}${ACCEPT_INVITE_PATH}?email=${encodeURIComponent(email)}`;

  // Send invite notification email via inviteUserByEmail.
  // The invite.html template renders {{ .Data.accept_invite_url }} as a plain link.
  // {{ .ConfirmationURL }} is NOT rendered in the template — the magic link is unused.
  const { error: sendError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { accept_invite_url: acceptInviteUrl },
  });

  if (sendError) {
    // Roll back invitation if email failed
    await adminClient.from('account_invitations').update({
      status: 'REVOKED',
      meta: { source: 'invite-account-user', send_failed_at: new Date().toISOString(), send_failed_message: sendError.message },
    }).eq('id', invitation.id).eq('status', 'PENDING');

    return json(500, {
      ok: false,
      code: 'INVITE_SEND_FAILED',
      message: sendError.message || 'Einladungs-E-Mail konnte nicht gesendet werden.',
    });
  }

  return json(200, {
    ok: true,
    emailSent: true,
    invitationId: invitation.id,
    accountName: account.name,
  });
});
