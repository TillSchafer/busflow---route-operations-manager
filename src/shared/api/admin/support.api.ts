import { invokeAuthedFunction } from '../../lib/supabaseFunctions';
import { SupportPasswordResetResult } from './types';

export const SupportAdminApi = {
  async sendPasswordReset(payload: { accountId: string; userId?: string; email?: string }) {
    const data = await invokeAuthedFunction<
      { accountId: string; userId?: string; email?: string },
      SupportPasswordResetResult
    >('platform-send-password-reset', payload);
    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Reset-Link konnte nicht gesendet werden.');
    }

    return data as SupportPasswordResetResult;
  }
};
