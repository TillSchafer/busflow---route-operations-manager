import React, { useEffect, useMemo, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../shared/lib/supabase';

type ViewState = 'loading' | 'needs_password' | 'saving' | 'success' | 'error';

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

const isAllowedOtpType = (value: string | null): value is EmailOtpType => {
  if (!value) return false;
  return ['invite', 'magiclink', 'signup', 'recovery', 'email_change', 'email'].includes(value);
};

const mapClaimError = (code?: string): string => {
  switch (code) {
    case 'NO_PENDING_INVITATION':
      return 'Keine offene Einladung gefunden. Bitte lassen Sie sich erneut einladen.';
    case 'ACTIVE_MEMBERSHIP_EXISTS':
      return 'Ihr Konto ist bereits einem anderen aktiven Account zugeordnet.';
    case 'NOT_AUTHENTICATED':
      return 'Sitzung abgelaufen. Öffnen Sie den Einladungslink erneut.';
    case 'PROFILE_MISSING':
      return 'Profil nicht gefunden. Bitte kontaktieren Sie den Support.';
    default:
      return 'Einladung konnte nicht abgeschlossen werden.';
  }
};

const readAuthUrlPayload = (): AuthUrlPayload => {
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

const clearAuthParamsFromUrl = () => {
  if (!window.location.search && !window.location.hash) return;
  window.history.replaceState({}, document.title, window.location.pathname);
};

const getUrlAuthErrorMessage = (payload: AuthUrlPayload): string | null => {
  const parts = [payload.urlErrorDescription, payload.urlError, payload.urlErrorCode]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (!parts.length) return null;
  return parts.join(' | ');
};

const hasActiveMembership = async (userId: string): Promise<boolean> => {
  const { count, error } = await supabase
    .from('account_memberships')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (error) return false;
  return (count || 0) > 0;
};

const hasInvitedMembership = async (userId: string): Promise<boolean> => {
  const { count, error } = await supabase
    .from('account_memberships')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'INVITED');

  if (error) return false;
  return (count || 0) > 0;
};

const AcceptInvite: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<ViewState>('loading');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorText, setErrorText] = useState('');

  const authPayload = useMemo(() => readAuthUrlPayload(), []);
  const isRecoveryFlow = authPayload.type === 'recovery';

  useEffect(() => {
    const init = async () => {
      setState('loading');
      setErrorText('');

      let latestAuthError: string | null = null;

      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session && authPayload.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(authPayload.code);
        if (error) latestAuthError = error.message;

        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session && (authPayload.tokenHash || authPayload.token) && isAllowedOtpType(authPayload.type)) {
        const inviteTokenHash = authPayload.tokenHash || authPayload.token;
        const { error } = await supabase.auth.verifyOtp({
          token_hash: inviteTokenHash as string,
          type: authPayload.type,
        });

        if (error && !latestAuthError) {
          latestAuthError = error.message;
        }

        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session && authPayload.accessToken && authPayload.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: authPayload.accessToken,
          refresh_token: authPayload.refreshToken,
        });

        if (error && !latestAuthError) {
          latestAuthError = error.message;
        }

        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session) {
        const urlError = getUrlAuthErrorMessage(authPayload);
        const inviteTokenPresent = Boolean((authPayload.tokenHash || authPayload.token) && authPayload.type);
        const fallbackMessage = inviteTokenPresent
          ? 'Invite-Link ungültig oder abgelaufen. Bitte neue Einladung anfordern.'
          : 'Keine gültige Einladungssitzung gefunden. Öffnen Sie den Einladungslink aus der E-Mail erneut.';
        setErrorText(
          urlError
            || latestAuthError
            || fallbackMessage
        );
        setState('error');
        return;
      }

      clearAuthParamsFromUrl();
      setState('needs_password');
    };

    init().catch(err => {
      setErrorText(err instanceof Error ? err.message : 'Einladung konnte nicht verarbeitet werden.');
      setState('error');
    });
  }, [authPayload]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setErrorText('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== passwordConfirm) {
      setErrorText('Die Passwörter stimmen nicht überein.');
      return;
    }

    setState('saving');
    setErrorText('');

    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        throw passwordError;
      }

      if (!isRecoveryFlow) {
        const { data: claimResult, error: claimError } = await supabase.rpc('claim_my_invitation', {
          p_account_id: null,
        });

        if (claimError) {
          throw claimError;
        }

        const claimCode = claimResult?.code as string | undefined;
        const claimOk = Boolean(claimResult?.ok);

        if (!claimOk && claimCode !== 'ALREADY_ACTIVE') {
          if (claimCode === 'NO_PENDING_INVITATION') {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            if (userId) {
              const activeMembershipExists = await hasActiveMembership(userId);
              if (!activeMembershipExists) {
                throw new Error(mapClaimError(claimCode));
              }
            } else {
              throw new Error(mapClaimError(claimCode));
            }
          } else {
            throw new Error(mapClaimError(claimCode));
          }
        }
      } else {
        // Recovery flow (password reset): if the admin sent a reactivation email,
        // the user has a fresh PENDING invitation. Claim it now to activate their membership.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (userId && (await hasInvitedMembership(userId))) {
          const { data: claimResult, error: claimError } = await supabase.rpc('claim_my_invitation', {
            p_account_id: null,
          });

          if (claimError) {
            throw claimError;
          }

          const claimCode = claimResult?.code as string | undefined;
          if (!claimResult?.ok && claimCode !== 'ALREADY_ACTIVE') {
            throw new Error(mapClaimError(claimCode));
          }
        }
      }

      setState('success');
      window.setTimeout(() => navigate('/'), 1200);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Passwort konnte nicht gesetzt werden.');
      setState('needs_password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-8 py-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {isRecoveryFlow ? 'Passwort zurücksetzen' : 'Einladung abschließen'}
        </h2>

        {state === 'loading' && (
          <p className="text-sm text-slate-600">Einladung wird geprüft...</p>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{errorText}</p>
            <Link
              to="/"
              className="inline-flex items-center justify-center w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Zur Anmeldung
            </Link>
          </div>
        )}

        {(state === 'needs_password' || state === 'saving') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600">
              {isRecoveryFlow
                ? 'Legen Sie jetzt ein neues Passwort fest, um wieder Zugriff zu erhalten.'
                : 'Legen Sie jetzt Ihr Passwort fest. Danach wird Ihr Zugang automatisch aktiviert.'}
            </p>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Neues Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="Mindestens 8 Zeichen"
                minLength={8}
                required
                disabled={state === 'saving'}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Passwort wiederholen</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                minLength={8}
                required
                disabled={state === 'saving'}
              />
            </div>
            {errorText && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{errorText}</p>}
            <button
              type="submit"
              disabled={state === 'saving'}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {state === 'saving' ? 'Wird gespeichert...' : 'Passwort setzen'}
            </button>
          </form>
        )}

        {state === 'success' && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
              {isRecoveryFlow
                ? 'Passwort erfolgreich zurückgesetzt.'
                : 'Passwort erfolgreich gesetzt. Ihr Zugang wurde aktiviert.'}
            </p>
            <p className="text-sm text-slate-600">Sie werden weitergeleitet...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
