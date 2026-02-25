import { supabase } from '../../lib/supabase';
import { invokeAuthedFunction } from '../../lib/supabaseFunctions';
import {
  DeleteUserResult,
  InvitationItem,
  ManageInvitationAction,
  ManageInvitationResult,
  InvitationRole,
  MembershipItem,
  MembershipRole,
  PlatformAccount,
  UpdateMembershipRoleResult,
} from './types';

const invokeInvite = async (payload: { accountId: string; email: string; role: InvitationRole }) => {
  const data = await invokeAuthedFunction<
    { accountId: string; email: string; role: InvitationRole },
    { ok: boolean; emailSent?: boolean; message?: string; code?: string; invitationId?: string; accountName?: string }
  >('invite-account-user', payload);
  if (!data?.ok) {
    throw new Error(data?.message || data?.code || 'Einladung konnte nicht erstellt werden.');
  }

  return data;
};

type TeamAdminCodeError = Error & { code?: string };

const createTeamAdminCodeError = (message: string, code?: string): TeamAdminCodeError => {
  const error = new Error(message) as TeamAdminCodeError;
  if (code) error.code = code;
  return error;
};

export const TeamAdminApi = {
  async getTeamAdminData(accountId: string) {
    const { error: expireByRpcError } = await supabase.rpc('mark_expired_invitations', {
      p_account_id: accountId,
    });

    if (expireByRpcError) {
      const nowIso = new Date().toISOString();
      const { error: expireFallbackError } = await supabase
        .from('account_invitations')
        .update({ status: 'EXPIRED' })
        .eq('account_id', accountId)
        .eq('status', 'PENDING')
        .lte('expires_at', nowIso);

      if (expireFallbackError) {
        // Expiration normalization is best-effort and must not block admin data loading.
        console.warn('mark_expired_invitations failed', {
          rpc: expireByRpcError.message,
          fallback: expireFallbackError.message,
        });
      }
    }

    const [membershipsRes, invitationsRes, accountRes] = await Promise.all([
      supabase
        .from('account_memberships')
        .select(`
          id,
          account_id,
          user_id,
          role,
          status,
          created_at,
          profiles(id, email, full_name)
        `)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('account_invitations')
        .select('id, account_id, email, role, status, expires_at, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('platform_accounts')
        .select('id, name, slug, status, created_at, updated_at, archived_at, archived_by')
        .eq('id', accountId)
        .maybeSingle()
    ]);

    if (membershipsRes.error) throw membershipsRes.error;
    if (invitationsRes.error) throw invitationsRes.error;
    if (accountRes.error) throw accountRes.error;

    return {
      memberships: (membershipsRes.data || []) as MembershipItem[],
      invitations: (invitationsRes.data || []) as InvitationItem[],
      account: (accountRes.data || null) as PlatformAccount | null
    };
  },

  async inviteTeamMember(payload: { accountId: string; email: string; role: InvitationRole }) {
    return invokeInvite(payload);
  },

  async updateMembershipRole(accountId: string, membershipId: string, role: MembershipRole) {
    const data = await invokeAuthedFunction<
      { accountId: string; membershipId: string; role: MembershipRole },
      UpdateMembershipRoleResult
    >('admin-update-membership-role-v1', { accountId, membershipId, role });

    if (!data?.ok) {
      throw createTeamAdminCodeError(
        data?.message || data?.code || 'Rolle konnte nicht gespeichert werden.',
        data?.code
      );
    }

    return data as UpdateMembershipRoleResult;
  },

  async suspendMembership(accountId: string, membershipId: string) {
    const { error } = await supabase
      .from('account_memberships')
      .update({ status: 'SUSPENDED' })
      .eq('account_id', accountId)
      .eq('id', membershipId);

    if (error) throw error;
  },

  async revokeInvitation(accountId: string, invitationId: string) {
    const { error } = await supabase
      .from('account_invitations')
      .update({ status: 'REVOKED' })
      .eq('account_id', accountId)
      .eq('id', invitationId)
      .eq('status', 'PENDING');

    if (error) throw error;
  },

  async manageInvitation(payload: {
    accountId: string;
    invitationId: string;
    action: ManageInvitationAction;
  }): Promise<ManageInvitationResult> {
    const data = await invokeAuthedFunction<
      { accountId: string; invitationId: string; action: ManageInvitationAction },
      ManageInvitationResult
    >('admin-manage-invitation-v1', payload);

    if (!data?.ok) {
      throw createTeamAdminCodeError(
        data?.message || data?.code || 'Einladung konnte nicht verarbeitet werden.',
        data?.code
      );
    }

    return data as ManageInvitationResult;
  },

  async deleteUserHard(accountId: string, userId: string, reason?: string): Promise<DeleteUserResult> {
    const data = await invokeAuthedFunction<
      { accountId: string; userId: string; reason?: string },
      DeleteUserResult
    >('admin-delete-user-v3', { accountId, userId, reason });
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'User konnte nicht gelöscht werden.');
    }

    return data as DeleteUserResult;
  },

};
