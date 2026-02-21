import { invokeAuthedFunction } from '../../lib/supabaseFunctions';

export const SupportAdminApi = {
  async sendPasswordReset(payload: { accountId: string; email: string }) {
    const data = await invokeAuthedFunction<
      { accountId: string; email: string },
      { ok: boolean; message?: string; code?: string }
    >('platform-send-password-reset', payload);
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Reset-Link konnte nicht gesendet werden.');
    }

    return data;
  }
};
