import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { normalizeEmail } from './utils.ts';

export const INVITE_BLOCKER_ACTIVE_MEMBERSHIP = 'ACTIVE_MEMBERSHIP_EXISTS';
export const INVITE_BLOCKER_CONFIRMED_USER = 'CONFIRMED_USER_REQUIRES_MANUAL_ACTION';

type AuthLookupUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

export type InviteTargetState = {
  email: string;
  profileId: string | null;
  authUserId: string | null;
  isEmailConfirmed: boolean;
  activeMembershipCount: number;
  activeMembershipAccountId: string | null;
  canDeleteGhostUser: boolean;
};

export type RetryInviteResult = {
  emailSent: boolean;
  attempts: number;
  inviteErrorMessage: string | null;
  deletedGhostUser: boolean;
  blockerCode?: typeof INVITE_BLOCKER_ACTIVE_MEMBERSHIP | typeof INVITE_BLOCKER_CONFIRMED_USER;
  blockerMessage?: string;
};

export type ExistingPendingInvitation = {
  id: string;
  account_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  source: string;
  isExpired: boolean;
};

const isUserNotFoundAuthError = (message?: string) => {
  const normalized = message?.toLowerCase() || '';
  return normalized.includes('user not found') || normalized.includes('not found');
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isAlreadyRegisteredError = (message?: string) => {
  const normalized = message?.toLowerCase() || '';
  return normalized.includes('already registered') || normalized.includes('already exists');
};

export const getAuthUserByEmail = async (
  adminClient: ReturnType<typeof createClient>,
  email: string
): Promise<AuthLookupUser | null> => {
  const normalizedEmail = normalizeEmail(email);
  const perPage = 200;
  const maxPages = 50;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`auth user lookup failed: ${error.message}`);
    }

    const users = data?.users || [];
    const matched = users.find((item) => normalizeEmail(item.email || '') === normalizedEmail) || null;
    if (matched) {
      return {
        id: matched.id,
        email: matched.email,
        email_confirmed_at: matched.email_confirmed_at,
      };
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
};

export const getInvitationTargetState = async (
  adminClient: ReturnType<typeof createClient>,
  email: string
): Promise<InviteTargetState> => {
  const normalized = normalizeEmail(email);

  const { data: profileRows, error: profileLookupError } = await adminClient
    .from('profiles')
    .select('id')
    .ilike('email', normalized)
    .limit(1);

  if (profileLookupError) {
    throw new Error(`profile lookup failed: ${profileLookupError.message}`);
  }

  const profileId = profileRows?.[0]?.id || null;
  let authUser: AuthLookupUser | null = null;

  if (profileId) {
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(profileId);
    if (authUserError && !isUserNotFoundAuthError(authUserError.message)) {
      throw new Error(`auth user lookup by id failed: ${authUserError.message}`);
    }
    if (authUserData?.user) {
      authUser = {
        id: authUserData.user.id,
        email: authUserData.user.email,
        email_confirmed_at: authUserData.user.email_confirmed_at,
      };
    }
  }

  if (!authUser) {
    authUser = await getAuthUserByEmail(adminClient, normalized);
  }

  const membershipUserId = profileId || authUser?.id || null;
  let activeMembershipCount = 0;
  let activeMembershipAccountId: string | null = null;

  if (membershipUserId) {
    const { data: activeRows, count, error: activeMembershipError } = await adminClient
      .from('account_memberships')
      .select('id, account_id', { count: 'exact' })
      .eq('user_id', membershipUserId)
      .eq('status', 'ACTIVE')
      .limit(1);

    if (activeMembershipError) {
      throw new Error(`active membership lookup failed: ${activeMembershipError.message}`);
    }

    activeMembershipCount = count || 0;
    activeMembershipAccountId = activeRows?.[0]?.account_id || null;
  }

  const isEmailConfirmed = !!authUser?.email_confirmed_at;
  const canDeleteGhostUser = !!authUser?.id && !isEmailConfirmed && activeMembershipCount === 0;

  return {
    email: normalized,
    profileId,
    authUserId: authUser?.id || null,
    isEmailConfirmed,
    activeMembershipCount,
    activeMembershipAccountId,
    canDeleteGhostUser,
  };
};

export const deleteGhostUserIfSafe = async (
  adminClient: ReturnType<typeof createClient>,
  target: InviteTargetState
): Promise<boolean> => {
  if (!target.authUserId || !target.canDeleteGhostUser) {
    return false;
  }

  const { error } = await adminClient.auth.admin.deleteUser(target.authUserId);
  if (error) {
    throw new Error(`ghost user delete failed: ${error.message}`);
  }

  return true;
};

export const resolveExistingPendingInvitationForEmail = async (
  adminClient: ReturnType<typeof createClient>,
  email: string
): Promise<ExistingPendingInvitation[]> => {
  const normalized = normalizeEmail(email);
  const { data, error } = await adminClient
    .from('account_invitations')
    .select('id, account_id, email, role, status, expires_at, created_at, meta')
    .eq('status', 'PENDING')
    .ilike('email', normalized)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`pending invitation lookup failed: ${error.message}`);
  }

  const nowTs = Date.now();
  return (data || []).map((row) => {
    const meta = row.meta && typeof row.meta === 'object' ? row.meta as Record<string, unknown> : {};
    const sourceRaw = meta.source;
    const source = typeof sourceRaw === 'string' && sourceRaw.trim() ? sourceRaw.trim() : 'unknown';
    const expiresAtRaw = row.expires_at || new Date(0).toISOString();
    const isExpired = new Date(expiresAtRaw).getTime() <= nowTs;

    return {
      id: row.id,
      account_id: row.account_id,
      email: row.email,
      role: row.role,
      status: row.status,
      expires_at: expiresAtRaw,
      created_at: row.created_at,
      source,
      isExpired,
    };
  });
};

export const retryInviteUserByEmail = async (
  adminClient: ReturnType<typeof createClient>,
  params: {
    email: string;
    redirectTo: string;
    data: Record<string, unknown>;
    maxRetries?: number;
  }
): Promise<RetryInviteResult> => {
  const email = normalizeEmail(params.email);
  const maxRetries = Math.max(0, params.maxRetries ?? 2);
  const maxAttempts = maxRetries + 1;
  const backoff = [250, 500];
  let deletedGhostUser = false;
  let lastErrorMessage: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: params.data,
      redirectTo: params.redirectTo,
    });

    if (!error) {
      return {
        emailSent: true,
        attempts: attempt,
        inviteErrorMessage: null,
        deletedGhostUser,
      };
    }

    lastErrorMessage = error.message || 'Invite send failed.';
    if (!isAlreadyRegisteredError(error.message)) {
      return {
        emailSent: false,
        attempts: attempt,
        inviteErrorMessage: lastErrorMessage,
        deletedGhostUser,
      };
    }

    const target = await getInvitationTargetState(adminClient, email);
    if (target.activeMembershipCount > 0) {
      return {
        emailSent: false,
        attempts: attempt,
        inviteErrorMessage: lastErrorMessage,
        deletedGhostUser,
        blockerCode: INVITE_BLOCKER_ACTIVE_MEMBERSHIP,
        blockerMessage: 'Für diese E-Mail besteht bereits eine aktive Mitgliedschaft.',
      };
    }

    if (target.isEmailConfirmed) {
      return {
        emailSent: false,
        attempts: attempt,
        inviteErrorMessage: lastErrorMessage,
        deletedGhostUser,
        blockerCode: INVITE_BLOCKER_CONFIRMED_USER,
        blockerMessage: 'Diese E-Mail ist bereits registriert. Bitte über Login anmelden oder Passwort zurücksetzen.',
      };
    }

    const deleted = await deleteGhostUserIfSafe(adminClient, target);
    deletedGhostUser = deletedGhostUser || deleted;
    if (!deleted || attempt >= maxAttempts) {
      return {
        emailSent: false,
        attempts: attempt,
        inviteErrorMessage: lastErrorMessage,
        deletedGhostUser,
      };
    }

    await sleep(backoff[Math.min(attempt - 1, backoff.length - 1)]);
  }

  return {
    emailSent: false,
    attempts: maxAttempts,
    inviteErrorMessage: lastErrorMessage,
    deletedGhostUser,
  };
};
