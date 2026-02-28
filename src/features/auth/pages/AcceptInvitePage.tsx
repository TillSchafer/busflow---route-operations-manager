import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../shared/lib/supabase';
import AuthScreenShell from '../../../shared/components/auth/AuthScreenShell';
import {
  clearAuthParamsFromUrl,
  getUrlAuthErrorMessage,
  hydrateSessionFromAuthPayload,
  readAuthUrlPayload,
} from '../lib/auth-callback';

type ViewState = 'loading' | 'needs_password' | 'saving' | 'success' | 'error';

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

const isSignupVerificationType = (value: string | null) =>
  value === 'signup' || value === 'email' || value === 'magiclink';

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
  const isSignupVerificationFlow = !isRecoveryFlow && isSignupVerificationType(authPayload.type);

  const completeClaimFlow = useCallback(async (mode: 'invite' | 'signup' | 'recovery') => {
    if (mode !== 'recovery') {
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
            if (activeMembershipExists) {
              return;
            }
          }

          if (mode === 'signup') {
            throw new Error('Registrierungslink ungültig oder abgelaufen. Bitte Registrierung erneut starten.');
          }

          throw new Error(mapClaimError(claimCode));
        }

        throw new Error(mapClaimError(claimCode));
      }

      return;
    }

    // Recovery flow (password reset): if the admin sent a reactivation email,
    // the user has a fresh PENDING invitation. Claim it now to activate their membership.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId || !(await hasInvitedMembership(userId))) {
      return;
    }

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
  }, []);

  useEffect(() => {
    const init = async () => {
      setState('loading');
      setErrorText('');

      let latestAuthError: string | null = null;

      let {
        data: { session },
      } = await supabase.auth.getSession();

      // Session-only resume: user navigated to /auth/accept-invite while already
      // logged in but with no auth params in the URL (e.g. from the "Konto-Zugang
      // ausstehend" pending page). Try to claim an INVITED membership directly.
      const hasNoAuthParams =
        !authPayload.token && !authPayload.tokenHash && !authPayload.code &&
        !authPayload.accessToken && !authPayload.refreshToken && !authPayload.type &&
        !authPayload.urlError;

      if (session && hasNoAuthParams) {
        const userId = session.user.id;
        if (await hasInvitedMembership(userId)) {
          try {
            await completeClaimFlow('invite');
            setState('success');
            window.setTimeout(() => navigate('/'), 1200);
          } catch (error) {
            setErrorText(error instanceof Error ? error.message : 'Zugang konnte nicht aktiviert werden.');
            setState('error');
          }
          return;
        }
        if (await hasActiveMembership(userId)) {
          navigate('/');
          return;
        }
        setErrorText('Keine offene Einladung gefunden. Bitte lassen Sie sich erneut einladen.');
        setState('error');
        return;
      }

      if (!session) {
        const hydrated = await hydrateSessionFromAuthPayload(supabase, authPayload);
        session = hydrated.session;
        latestAuthError = hydrated.latestAuthError;
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
      if (isSignupVerificationFlow) {
        setState('saving');
        try {
          await completeClaimFlow('signup');
          setState('success');
          window.setTimeout(() => navigate('/'), 1200);
        } catch (error) {
          setErrorText(error instanceof Error ? error.message : 'Registrierung konnte nicht abgeschlossen werden.');
          setState('error');
        }
        return;
      }

      setState('needs_password');
    };

    init().catch(err => {
      setErrorText(err instanceof Error ? err.message : 'Einladung konnte nicht verarbeitet werden.');
      setState('error');
    });
  }, [authPayload, completeClaimFlow, isSignupVerificationFlow, navigate]);

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

      await completeClaimFlow(isRecoveryFlow ? 'recovery' : 'invite');

      setState('success');
      window.setTimeout(() => navigate('/'), 1200);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Passwort konnte nicht gesetzt werden.');
      setState('needs_password');
    }
  };

  return (
    <AuthScreenShell>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {isRecoveryFlow ? 'Passwort zurücksetzen' : isSignupVerificationFlow ? 'Registrierung abschließen' : 'Einladung abschließen'}
        </h2>

        {state === 'loading' && (
          <p className="text-sm text-slate-600">
            {isSignupVerificationFlow ? 'Registrierung wird geprüft...' : 'Einladung wird geprüft...'}
          </p>
        )}

        {state === 'saving' && isSignupVerificationFlow && (
          <p className="text-sm text-slate-600">Zugang wird aktiviert...</p>
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
            {isSignupVerificationFlow && (
              <Link
                to="/auth/register"
                className="inline-flex items-center justify-center w-full border border-slate-300 hover:border-slate-400 text-slate-700 px-4 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Neu registrieren
              </Link>
            )}
          </div>
        )}

        {(state === 'needs_password' || (state === 'saving' && !isSignupVerificationFlow)) && (
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
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
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
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
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
                : isSignupVerificationFlow
                  ? 'E-Mail erfolgreich bestätigt. Ihr Zugang wurde aktiviert.'
                  : 'Passwort erfolgreich gesetzt. Ihr Zugang wurde aktiviert.'}
            </p>
            <p className="text-sm text-slate-600">Sie werden weitergeleitet...</p>
          </div>
        )}
    </AuthScreenShell>
  );
};

export default AcceptInvite;
