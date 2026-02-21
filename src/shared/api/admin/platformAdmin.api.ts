import { supabase } from '../../lib/supabase';
import { invokeAuthedFunction } from '../../lib/supabaseFunctions';
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
    const data = await invokeAuthedFunction<
      { accountName: string; accountSlug: string; adminEmail: string },
      { ok: boolean; message?: string; code?: string; accountName?: string }
    >('platform-provision-account', payload);
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
    const data = await invokeAuthedFunction<
      { accountId: string; dryRun: boolean },
      DeleteAccountDryRunResult
    >('platform-delete-account', { accountId, dryRun: true });
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Dry-Run für Firmenlöschung fehlgeschlagen.');
    }

    return data as DeleteAccountDryRunResult;
  },

  async deleteAccountHard(accountId: string, confirmSlug: string, reason?: string): Promise<DeleteAccountResult> {
    const data = await invokeAuthedFunction<
      { accountId: string; dryRun: boolean; confirmSlug: string; reason?: string },
      DeleteAccountResult
    >('platform-delete-account', { accountId, dryRun: false, confirmSlug, reason });
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Firma konnte nicht gelöscht werden.');
    }

    return data as DeleteAccountResult;
  },

  async deleteUserHard(userId: string, accountId?: string, reason?: string): Promise<DeleteUserResult> {
    const data = await invokeAuthedFunction<
      { userId: string; accountId?: string; reason?: string },
      DeleteUserResult
    >('admin-delete-user-v3', { userId, accountId, reason });
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'User konnte nicht gelöscht werden.');
    }

    return data as DeleteUserResult;
  }
};
