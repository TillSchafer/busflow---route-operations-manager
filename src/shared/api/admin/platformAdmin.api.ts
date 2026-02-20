import { supabase } from '../../lib/supabase';
import { PlatformAccount, PlatformAccountStatus } from './types';

export const PlatformAdminApi = {
  async getAccounts() {
    const { data, error } = await supabase
      .from('platform_accounts')
      .select('id, name, slug, status, created_at, updated_at, archived_at, archived_by')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PlatformAccount[];
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
  }
};
