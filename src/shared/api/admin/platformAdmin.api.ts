import { supabase } from '../../lib/supabase';
import {
  DeleteAccountDryRunResult,
  DeleteAccountResult,
  DeleteUserResult,
  MembershipItem,
  PlatformAccount,
  PlatformAccountStatus
} from './types';

export const PlatformAdminApi = {
  async getAccounts() {
    const { data, error } = await supabase
      .from('platform_accounts')
      .select('id, name, slug, status, created_at, updated_at, archived_at, archived_by')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PlatformAccount[];
  },

  async getAccountMembers(accountId: string): Promise<MembershipItem[]> {
    const { data, error } = await supabase
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
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as MembershipItem[];
  },

  async provisionAccount(payload: { accountName: string; accountSlug: string; adminEmail: string }) {
    const { data, error } = await supabase.functions.invoke('platform-provision-account', {
      body: payload
    });

    if (error) {
      throw new Error(error.message || 'Firma konnte nicht angelegt werden.');
    }
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Firma konnte nicht angelegt werden.');
    }

    return data;
  },

  async updateAccountStatus(accountId: string, status: PlatformAccountStatus) {
    const payload: Record<string, unknown> = { status };
    if (status === 'ARCHIVED') {
      payload.archived_at = new Date().toISOString();
    } else {
      payload.archived_at = null;
    }

    const { error } = await supabase
      .from('platform_accounts')
      .update(payload)
      .eq('id', accountId);

    if (error) throw error;
  },

  async deleteAccountDryRun(accountId: string): Promise<DeleteAccountDryRunResult> {
    const { data, error } = await supabase.functions.invoke('platform-delete-account', {
      body: { accountId, dryRun: true }
    });

    if (error) {
      throw new Error(error.message || 'Dry-Run für Firmenlöschung fehlgeschlagen.');
    }
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Dry-Run für Firmenlöschung fehlgeschlagen.');
    }

    return data as DeleteAccountDryRunResult;
  },

  async deleteAccountHard(accountId: string, confirmSlug: string, reason?: string): Promise<DeleteAccountResult> {
    const { data, error } = await supabase.functions.invoke('platform-delete-account', {
      body: { accountId, dryRun: false, confirmSlug, reason }
    });

    if (error) {
      throw new Error(error.message || 'Firma konnte nicht gelöscht werden.');
    }
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Firma konnte nicht gelöscht werden.');
    }

    return data as DeleteAccountResult;
  },

  async deleteUserHard(userId: string, accountId?: string, reason?: string): Promise<DeleteUserResult> {
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId, accountId, reason }
    });

    if (error) {
      throw new Error(error.message || 'User konnte nicht gelöscht werden.');
    }
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'User konnte nicht gelöscht werden.');
    }

    return data as DeleteUserResult;
  }
};
