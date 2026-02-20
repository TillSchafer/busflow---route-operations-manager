import { supabase } from '../../lib/supabase';
import { InvitationItem, InvitationRole, MembershipItem, MembershipRole, PlatformAccount } from './types';

const invokeInvite = async (payload: { accountId: string; email: string; role: InvitationRole }) => {
  const { data, error } = await supabase.functions.invoke('invite-account-user', { body: payload });

  if (error) {
    throw new Error(error.message || 'Einladung konnte nicht erstellt werden.');
  }
  if (!data?.ok) {
    throw new Error(data?.message || data?.code || 'Einladung konnte nicht erstellt werden.');
  }

  return data;
};

export const TeamAdminApi = {
  async getTeamAdminData(accountId: string) {
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
    const { error } = await supabase
      .from('account_memberships')
      .update({ role })
      .eq('account_id', accountId)
      .eq('id', membershipId);

    if (error) throw error;
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
  }
};
