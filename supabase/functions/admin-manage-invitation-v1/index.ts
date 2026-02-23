import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken, isUuid } from '../_shared/utils.ts';

type ManageInvitationAction = 'DELETE' | 'RESEND';
type InvitationRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';

type ManageInvitationRequest = {
  accountId?: string;
  invitationId?: string;
  action?: ManageInvitationAction;
  reason?: string;
};

type InvitationRow = {
  id: string;
  account_id: string;
  email: string;
  role: InvitationRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  meta: Record<string, unknown> | null;
};

const INVITE_REDIRECT_PATH = '/auth/accept-invite';

const normalizePathname = (pathname: string) => {
  if (!pathname) return '/';
  const normalized = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return normalized || '/';
};

const toBusinessError = (code: string, message?: string) =>
  json(200, {
    ok: false,
    code,
    message: message || code,
  });

const isUserNotFoundAuthError = (message?: string) => {
  const normalized = message?.toLowerCase() || '';
  return normalized.includes('user not found') || normalized.includes('not found');
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

  let body: ManageInvitationRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  const accountId = body.accountId?.trim();
  const invitationId = body.invitationId?.trim();
  const reason = body.reason?.trim() || null;
  const action = body.action?.trim().toUpperCase() as ManageInvitationAction | undefined;

  if (!isUuid(accountId) || !isUuid(invitationId) || (action !== 'DELETE' && action !== 'RESEND')) {
    return json(400, {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Valid accountId, invitationId and action (DELETE|RESEND) are required.',
    });
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('global_role')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfileError || !callerProfile) {
    return toBusinessError('FORBIDDEN');
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
      return toBusinessError('FORBIDDEN');
    }
  }

  const { data: invitation, error: invitationError } = await adminClient
    .from('account_invitations')
    .select('id, account_id, email, role, status, meta')
    .eq('id', invitationId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (invitationError) {
    return json(500, { ok: false, code: 'LOOKUP_FAILED', message: invitationError.message });
  }
  const invitationRow = invitation as InvitationRow | null;

  if (!invitationRow) {
    return toBusinessError('INVITATION_NOT_FOUND');
  }
  if (invitationRow.status !== 'PENDING') {
    return toBusinessError('INVITATION_NOT_PENDING');
  }

  const redirectTo = Deno.env.get('APP_INVITE_REDIRECT_URL')?.trim();
  if (action === 'RESEND') {
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
  }

  const email = invitationRow.email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const baseMeta = invitationRow.meta && typeof invitationRow.meta === 'object'
    ? invitationRow.meta
    : {};

  const { data: profileRows, error: profileLookupError } = await adminClient
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .limit(1);

  if (profileLookupError) {
    return json(500, { ok: false, code: 'LOOKUP_FAILED', message: profileLookupError.message });
  }

  const profileId = profileRows?.[0]?.id || null;
  let activeMembershipCount = 0;
  let isEmailConfirmed = false;
  let canDeleteGhostUser = false;

  if (profileId) {
    const { count, error: activeMembershipError } = await adminClient
      .from('account_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .eq('status', 'ACTIVE');

    if (activeMembershipError) {
      return json(500, { ok: false, code: 'LOOKUP_FAILED', message: activeMembershipError.message });
    }
    activeMembershipCount = count || 0;

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(profileId);
    if (authUserError && !isUserNotFoundAuthError(authUserError.message)) {
      return json(500, { ok: false, code: 'LOOKUP_FAILED', message: authUserError.message });
    }

    if (authUserData?.user) {
      isEmailConfirmed = !!authUserData.user.email_confirmed_at;
      canDeleteGhostUser = !isEmailConfirmed && activeMembershipCount === 0;
    }
  }

  const revokeMeta = {
    ...baseMeta,
    managed_action: action,
    managed_at: nowIso,
    managed_by: caller.id,
    managed_reason: reason,
    managed_source: 'admin-manage-invitation-v1',
  };

  const { data: revokedRow, error: revokeError } = await adminClient
    .from('account_invitations')
    .update({
      status: 'REVOKED',
      meta: revokeMeta,
    })
    .eq('id', invitationRow.id)
    .eq('account_id', accountId)
    .eq('status', 'PENDING')
    .select('id')
    .maybeSingle();

  if (revokeError) {
    return json(500, { ok: false, code: 'INVITATION_REVOKE_FAILED', message: revokeError.message });
  }
  if (!revokedRow) {
    return toBusinessError('INVITATION_NOT_PENDING');
  }

  let deletedGhostUser = false;
  let warningCode: string | null = null;
  let warningMessage: string | null = null;

  if (profileId && canDeleteGhostUser) {
    const { error: ghostDeleteError } = await adminClient.auth.admin.deleteUser(profileId);
    if (ghostDeleteError) {
      return json(500, { ok: false, code: 'GHOST_USER_DELETE_FAILED', message: ghostDeleteError.message });
    }
    deletedGhostUser = true;
  } else if (profileId && activeMembershipCount > 0) {
    warningCode = 'ACTIVE_MEMBERSHIP_EXISTS';
    warningMessage = 'Einladung wurde widerrufen, der bestehende aktive User wurde nicht gelöscht.';
  } else if (profileId && isEmailConfirmed) {
    warningCode = 'CONFIRMED_USER_REQUIRES_MANUAL_ACTION';
    warningMessage = 'Einladung wurde widerrufen, bestätigter User wurde aus Sicherheitsgründen nicht gelöscht.';
  }

  let emailSent: boolean | undefined;
  let newInvitationId: string | undefined;
  let responseCode: string | undefined = warningCode || undefined;
  let responseMessage: string | undefined = warningMessage || undefined;

  if (action === 'RESEND') {
    if (activeMembershipCount > 0) {
      emailSent = false;
    } else {
      const { data: newInvitation, error: newInvitationError } = await adminClient
        .from('account_invitations')
        .insert({
          account_id: accountId,
          email,
          role: invitationRow.role,
          status: 'PENDING',
          invited_by: caller.id,
          meta: {
            source: 'admin-manage-invitation-v1',
            replaced_invitation_id: invitationRow.id,
            reason,
          },
        })
        .select('id')
        .single();

      if (newInvitationError || !newInvitation) {
        return json(500, {
          ok: false,
          code: 'INVITATION_CREATE_FAILED',
          message: newInvitationError?.message || 'Failed to create new invitation.',
        });
      }

      newInvitationId = newInvitation.id;

      const { error: sendInviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          invited_account_id: accountId,
          invited_role: invitationRow.role,
          invitation_id: newInvitation.id,
        },
        redirectTo,
      });

      if (sendInviteError) {
        emailSent = false;
        responseCode = 'INVITATION_CREATED_EMAIL_FAILED';
        responseMessage = sendInviteError.message;
      } else {
        emailSent = true;
        if (!responseMessage) {
          responseMessage = 'Einladung wurde erneut versendet.';
        }
      }
    }
  }

  const { error: auditInsertError } = await adminClient
    .from('admin_access_audit')
    .insert({
      admin_user_id: caller.id,
      target_account_id: accountId,
      action: action === 'RESEND' ? 'INVITATION_RESENT' : 'INVITATION_REVOKED',
      resource: 'account_invitations',
      resource_id: invitationRow.id,
      meta: {
        invitation_id: invitationRow.id,
        invitation_email: email,
        invitation_role: invitationRow.role,
        action,
        reason,
        deleted_ghost_user: deletedGhostUser,
        warning_code: warningCode,
        warning_message: warningMessage,
        new_invitation_id: newInvitationId || null,
        email_sent: emailSent ?? null,
      },
    });

  return json(200, {
    ok: true,
    code: responseCode,
    message: responseMessage,
    emailSent,
    deletedGhostUser,
    newInvitationId,
    auditError: auditInsertError?.message || null,
  });
});
