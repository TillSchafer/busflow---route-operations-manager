import { invokeAuthedFunction } from '../../lib/supabaseFunctions';

type EmailChangeResult = { ok: true; code: 'EMAIL_CHANGE_REQUESTED'; message?: string };
type PasswordResetResult = { ok: true; code: 'PASSWORD_RESET_REQUESTED'; message?: string };

export const ProfileSecurityApi = {
  async requestEmailChange(newEmail: string): Promise<EmailChangeResult> {
    const data = await invokeAuthedFunction<
      { action: string; newEmail: string },
      EmailChangeResult
    >('self-profile-security-v1', { action: 'REQUEST_EMAIL_CHANGE', newEmail });

    if (!data?.ok) {
      throw new Error('E-Mail-Änderung konnte nicht angefordert werden.');
    }

    return data;
  },

  async requestPasswordReset(): Promise<PasswordResetResult> {
    const data = await invokeAuthedFunction<
      { action: string },
      PasswordResetResult
    >('self-profile-security-v1', { action: 'REQUEST_PASSWORD_RESET' });

    if (!data?.ok) {
      throw new Error('Passwort-Reset konnte nicht angefordert werden.');
    }

    return data;
  },
};
