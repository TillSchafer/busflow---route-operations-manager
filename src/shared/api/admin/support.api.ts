import { supabase } from '../../lib/supabase';

export const SupportAdminApi = {
  async sendPasswordReset(payload: { accountId: string; email: string }) {
    const { data, error } = await supabase.functions.invoke('platform-send-password-reset', {
      body: payload
    });

    if (error) {
      throw new Error(error.message || 'Reset-Link konnte nicht gesendet werden.');
    }
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Reset-Link konnte nicht gesendet werden.');
    }

    return data;
  }
};
