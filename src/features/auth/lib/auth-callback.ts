import type { EmailOtpType, Session, SupabaseClient } from '@supabase/supabase-js';

type AuthUrlPayload = {
  type: string | null;
  code: string | null;
  tokenHash: string | null;
  token: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  urlError: string | null;
  urlErrorCode: string | null;
  urlErrorDescription: string | null;
};

const OTP_TYPES: EmailOtpType[] = ['invite', 'magiclink', 'signup', 'recovery', 'email_change', 'email'];

export const isAllowedOtpType = (value: string | null): value is EmailOtpType => {
  if (!value) return false;
  return OTP_TYPES.includes(value as EmailOtpType);
};

export const readAuthUrlPayload = (): AuthUrlPayload => {
  const query = new URLSearchParams(window.location.search);
  const hashRaw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hash = new URLSearchParams(hashRaw);
  const getParam = (key: string) => query.get(key) ?? hash.get(key);

  return {
    type: getParam('type'),
    code: getParam('code'),
    tokenHash: getParam('token_hash'),
    token: getParam('token'),
    accessToken: getParam('access_token'),
    refreshToken: getParam('refresh_token'),
    urlError: getParam('error'),
    urlErrorCode: getParam('error_code'),
    urlErrorDescription: getParam('error_description'),
  };
};

export const clearAuthParamsFromUrl = () => {
  if (!window.location.search && !window.location.hash) return;
  window.history.replaceState({}, document.title, window.location.pathname);
};

export const getUrlAuthErrorMessage = (payload: AuthUrlPayload): string | null => {
  const parts = [payload.urlErrorDescription, payload.urlError, payload.urlErrorCode]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (!parts.length) return null;
  return parts.join(' | ');
};

export const hydrateSessionFromAuthPayload = async (
  supabase: SupabaseClient,
  authPayload: AuthUrlPayload
): Promise<{ session: Session | null; latestAuthError: string | null }> => {
  let latestAuthError: string | null = null;
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && authPayload.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(authPayload.code);
    if (error) latestAuthError = error.message;
    ({ data: { session } } = await supabase.auth.getSession());
  }

  if (!session && (authPayload.tokenHash || authPayload.token) && isAllowedOtpType(authPayload.type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: (authPayload.tokenHash || authPayload.token) as string,
      type: authPayload.type as EmailOtpType,
    });
    if (error && !latestAuthError) latestAuthError = error.message;
    ({ data: { session } } = await supabase.auth.getSession());
  }

  if (!session && authPayload.accessToken && authPayload.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: authPayload.accessToken,
      refresh_token: authPayload.refreshToken,
    });
    if (error && !latestAuthError) latestAuthError = error.message;
    ({ data: { session } } = await supabase.auth.getSession());
  }

  return { session, latestAuthError };
};

export type { AuthUrlPayload };
