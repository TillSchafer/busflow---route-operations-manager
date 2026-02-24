import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, json, extractBearerToken, isUuid, normalizeEmail } from '../_shared/utils.ts';
import {
  INVITE_BLOCKER_ACTIVE_MEMBERSHIP,
  INVITE_BLOCKER_CONFIRMED_USER,
  type InviteTargetState,
  deleteGhostUserIfSafe,
  getInvitationTargetState,
  retryInviteUserByEmail,
} from '../_shared/inviteAuth.ts';

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

  const email = normalizeEmail(invitationRow.email);
  const nowIso = new Date().toISOString();
  const baseMeta = invitationRow.meta && typeof invitationRow.meta === 'object' ? invitationRow.meta : {};

  let targetState: InviteTargetState;
  try {
    targetState = await getInvitationTargetState(adminClient, email);
  } catch (error) {
    return json(500, {
      ok: false,
      code: 'LOOKUP_FAILED',
      message: error instanceof Error ? error.message : 'Failed to resolve invitation target state.',
    });
  }

  let warningCode: string | null = null;
  let warningMessage: string | null = null;

  if (targetState.activeMembershipCount > 0) {
    warningCode = INVITE_BLOCKER_ACTIVE_MEMBERSHIP;
    warningMessage = 'Einladung wurde widerrufen, da für diese E-Mail bereits ein aktiver Zugang existiert.';
  } else if (targetState.isEmailConfirmed) {
    warningCode = INVITE_BLOCKER_CONFIRMED_USER;
    warningMessage = 'Einladung wurde widerrufen. Die E-Mail ist bereits registriert, bitte Login oder Passwort-Reset nutzen.';
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
  let ghostDeleteAttempted = false;
  if (targetState.canDeleteGhostUser) {
    ghostDeleteAttempted = true;
    try {
      deletedGhostUser = await deleteGhostUserIfSafe(adminClient, targetState);
    } catch (error) {
      return json(500, {
        ok: false,
        code: 'GHOST_USER_DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete ghost user.',
      });
    }
  }

  let emailSent: boolean | undefined;
  let newInvitationId: string | undefined;
  let responseCode: string | undefined = warningCode || undefined;
  let responseMessage: string | undefined = warningMessage || undefined;
  let inviteRetryCount: number | null = null;
  let inviteErrorMessage: string | null = null;

  if (action === 'RESEND') {
    if (warningCode) {
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

      let retryResult;
      try {
        retryResult = await retryInviteUserByEmail(adminClient, {
          email,
          redirectTo: redirectTo as string,
          data: {
            invited_account_id: accountId,
            invited_role: invitationRow.role,
            invitation_id: newInvitation.id,
          },
          maxRetries: 2,
        });
      } catch (error) {
        return json(500, {
          ok: false,
          code: 'INVITATION_SEND_FAILED',
          message: error instanceof Error ? error.message : 'Failed to send invitation email.',
        });
      }

      inviteRetryCount = retryResult.attempts;
      inviteErrorMessage = retryResult.inviteErrorMessage;
      deletedGhostUser = deletedGhostUser || retryResult.deletedGhostUser;
      ghostDeleteAttempted = ghostDeleteAttempted || retryResult.deletedGhostUser;

      if (!retryResult.emailSent) {
        emailSent = false;
        responseCode = retryResult.blockerCode || 'INVITATION_CREATED_EMAIL_FAILED';
        responseMessage = retryResult.blockerMessage || retryResult.inviteErrorMessage || 'Invitation email could not be sent.';

        const { error: rollbackError } = await adminClient
          .from('account_invitations')
          .update({
            status: 'REVOKED',
            meta: {
              source: 'admin-manage-invitation-v1',
              replaced_invitation_id: invitationRow.id,
              reason,
              send_failed_at: new Date().toISOString(),
              send_failed_code: responseCode,
              send_failed_message: responseMessage,
            },
          })
          .eq('id', newInvitation.id)
          .eq('status', 'PENDING');

        if (rollbackError) {
          return json(500, {
            ok: false,
            code: 'INVITATION_SEND_ROLLBACK_FAILED',
            message: rollbackError.message,
          });
        }
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
        auth_user_id: targetState.authUserId,
        auth_email_confirmed: targetState.isEmailConfirmed,
        active_membership_count: targetState.activeMembershipCount,
        active_membership_account_id: targetState.activeMembershipAccountId,
        ghost_delete_attempted: ghostDeleteAttempted,
        ghost_deleted: deletedGhostUser,
        warning_code: warningCode,
        warning_message: warningMessage,
        new_invitation_id: newInvitationId || null,
        email_sent: emailSent ?? null,
        invite_retry_count: inviteRetryCount,
        invite_error_message: inviteErrorMessage,
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
