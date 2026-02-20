import React, { useEffect, useMemo, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../shared/lib/supabase';

type ViewState = 'loading' | 'needs_password' | 'saving' | 'success' | 'error';

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

const AcceptInvite: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<ViewState>('loading');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorText, setErrorText] = useState('');

  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const init = async () => {
      setState('loading');
      setErrorText('');

      let { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData.session;

      if (!session) {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (tokenHash && isAllowedOtpType(type)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type
          });

          if (error) {
            setErrorText('Der Einladungslink ist ungültig oder abgelaufen. Bitte lassen Sie sich erneut einladen.');
            setState('error');
            return;
          }

          const { data: refreshedSession } = await supabase.auth.getSession();
          session = refreshedSession.session;
        }
      }

      if (!session) {
        setErrorText('Keine gültige Einladungssitzung gefunden. Öffnen Sie den Einladungslink aus der E-Mail erneut.');
        setState('error');
        return;
      }

      setState('needs_password');
    };

    init().catch(err => {
      setErrorText(err instanceof Error ? err.message : 'Einladung konnte nicht verarbeitet werden.');
      setState('error');
    });
  }, [searchParams]);

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

      const { data: claimResult, error: claimError } = await supabase.rpc('claim_my_invitation', {
        p_account_id: null
      });

      if (claimError) throw claimError;
      if (!claimResult?.ok && claimResult?.code !== 'ALREADY_ACTIVE') {
        throw new Error(mapClaimError(claimResult?.code));
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Einladung abschließen</h2>

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
              Legen Sie jetzt Ihr Passwort fest. Danach wird Ihr Zugang automatisch aktiviert.
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
              Passwort gesetzt. Ihr Zugang ist jetzt aktiv.
            </p>
            <p className="text-sm text-slate-600">Sie werden weitergeleitet...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
