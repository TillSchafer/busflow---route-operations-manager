import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../shared/lib/supabase';
import AuthScreenShell from '../shared/components/auth/AuthScreenShell';
import {
  clearAuthParamsFromUrl,
  getUrlAuthErrorMessage,
  hydrateSessionFromAuthPayload,
  readAuthUrlPayload,
} from '../features/auth/lib/auth-callback';

type ViewState = 'loading' | 'needs_password' | 'saving' | 'success_email' | 'success_password' | 'error';

const AccountSecurity: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<ViewState>('loading');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorText, setErrorText] = useState('');

  const authPayload = useMemo(() => readAuthUrlPayload(), []);

  const isEmailChangeFlow =
    authPayload.type === 'email_change' || authPayload.type === 'email';
  const isRecoveryFlow = authPayload.type === 'recovery';

  useEffect(() => {
    const init = async () => {
      setState('loading');
      setErrorText('');

      const urlError = getUrlAuthErrorMessage(authPayload);
      if (urlError) {
        setErrorText(urlError);
        setState('error');
        return;
      }

      const { session, latestAuthError } = await hydrateSessionFromAuthPayload(supabase, authPayload);

      if (!session) {
        setErrorText(
          latestAuthError ||
          'Kein gültiger Sicherheitslink. Bitte öffnen Sie den Link aus der E-Mail erneut.'
        );
        setState('error');
        return;
      }

      clearAuthParamsFromUrl();

      if (isEmailChangeFlow) {
        setState('success_email');
        window.setTimeout(() => navigate('/profile'), 2000);
        return;
      }

      if (isRecoveryFlow) {
        setState('needs_password');
        return;
      }

      // Fallback for unrecognized but authenticated flows
      setState('needs_password');
    };

    init().catch(err => {
      setErrorText(err instanceof Error ? err.message : 'Sicherheits-Callback konnte nicht verarbeitet werden.');
      setState('error');
    });
  }, [authPayload, isEmailChangeFlow, isRecoveryFlow, navigate]);

  const handleSetPassword = async (e: React.FormEvent) => {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setState('success_password');
      window.setTimeout(() => navigate('/profile'), 1500);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Passwort konnte nicht gesetzt werden.');
      setState('needs_password');
    }
  };

  return (
    <AuthScreenShell>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Kontosicherheit</h2>

      {state === 'loading' && (
        <p className="text-sm text-slate-600">Sicherheitslink wird geprüft...</p>
      )}

      {state === 'error' && (
        <div className="space-y-4">
          <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{errorText}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
          >
            Zur Startseite
          </Link>
        </div>
      )}

      {state === 'success_email' && (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            E-Mail-Adresse erfolgreich bestätigt.
          </p>
          <p className="text-sm text-slate-600">Sie werden weitergeleitet...</p>
        </div>
      )}

      {state === 'success_password' && (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            Passwort erfolgreich geändert.
          </p>
          <p className="text-sm text-slate-600">Sie werden weitergeleitet...</p>
        </div>
      )}

      {(state === 'needs_password' || state === 'saving') && (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <p className="text-sm text-slate-600">
            Legen Sie Ihr neues Passwort fest.
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
    </AuthScreenShell>
  );
};

export default AccountSecurity;
