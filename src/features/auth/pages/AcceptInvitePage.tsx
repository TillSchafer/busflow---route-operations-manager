import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../shared/lib/supabase';
import AuthScreenShell from '../../../shared/components/auth/AuthScreenShell';
import { hydrateSessionFromAuthPayload, readAuthUrlPayload, clearAuthParamsFromUrl } from '../lib/auth-callback';

// View states for the invitation onboarding flow.
// Recovery (password reset) reuses needs_password / saving / success.
type ViewState =
  | 'initial'         // Email input + "Code anfordern" button
  | 'code_sent'       // Code input visible, cooldown running
  | 'verifying'       // verifyOtp in progress
  | 'needs_password'  // Password form
  | 'saving'          // Saving password
  | 'success'
  | 'loading'         // Processing recovery URL token
  | 'error';

const CODE_COOLDOWN_SECONDS = 60;

const requestOnboardingCode = async (
  email: string,
): Promise<{ ok: boolean; code?: string; message?: string; secondsRemaining?: number }> => {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !anonKey) {
    return { ok: false, code: 'CONFIG_ERROR', message: 'Konfigurationsfehler.' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/request-onboarding-code-v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email }),
    });

    const body = await response.json().catch(() => null) as {
      ok?: boolean; code?: string; message?: string; secondsRemaining?: number;
    } | null;

    return {
      ok: body?.ok === true,
      code: body?.code,
      message: body?.message,
      secondsRemaining: body?.secondsRemaining,
    };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung.' };
  }
};

const mapRequestCodeError = (code?: string, message?: string, secondsRemaining?: number): string => {
  switch (code) {
    case 'NO_PENDING_INVITATION':
      return 'Keine offene Einladung für diese E-Mail-Adresse gefunden. Bitte prüfen Sie die Adresse oder fordern Sie eine neue Einladung an.';
    case 'RATE_LIMITED':
      return secondsRemaining
        ? `Bitte warten Sie noch ${secondsRemaining} Sekunden.`
        : 'Bitte warten Sie kurz.';
    case 'INVALID_EMAIL':
      return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    default:
      return message || 'Code konnte nicht gesendet werden. Bitte versuchen Sie es erneut.';
  }
};

const claimMyInvitation = async (): Promise<void> => {
  const { data, error } = await supabase.rpc('claim_my_invitation_secure', { p_account_id: null });
  if (error) throw error;

  const code = data?.code as string | undefined;
  const ok = Boolean(data?.ok);

  if (!ok && code !== 'ALREADY_ACTIVE' && code !== 'NO_PENDING_INVITATION') {
    throw new Error(code || 'Einladung konnte nicht abgeschlossen werden.');
  }
};

const AcceptInvite: React.FC = () => {
  const navigate = useNavigate();
  const initialAuthPayloadRef = useRef(readAuthUrlPayload());
  const initialAuthPayload = initialAuthPayloadRef.current;
  const isRecovery = initialAuthPayload.type === 'recovery';
  const urlParams = new URLSearchParams(window.location.search);
  const inviteEmailFromUrl = urlParams.get('email')?.trim().toLowerCase() || '';
  const shouldAutoStartCode = urlParams.get('autostart') === '1';
  const didAutoRequestCodeRef = useRef(false);

  const [state, setState] = useState<ViewState>(isRecovery ? 'loading' : 'initial');
  const [sessionChecked, setSessionChecked] = useState(isRecovery); // Skip check for recovery flow
  const [isRequestingCode, setIsRequestingCode] = useState(false); // Separate flag for re-request spinner

  const [email] = useState(inviteEmailFromUrl);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorText, setErrorText] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = (seconds: number) => {
    setCooldownSeconds(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  useEffect(() => {
    if (isRecovery) return;

    // Check session BEFORE the email guard: if the user already has an active session
    // (OTP verified, component remounted due to AuthContext state change, or redirected
    // here by AppRouter while authenticated without a membership), skip to password step.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && email) {
        // OTP just verified, component remounted due to auth state change → continue to password step.
        setState('needs_password');
      } else if (session?.user && !email) {
        // Authenticated but no invite context (AppRouter redirect loop) → sign out and show login.
        await supabase.auth.signOut();
        navigate('/');
        return;
      } else if (!email) {
        setErrorText('Ungültiger Einladungslink. Bitte öffnen Sie den Link erneut aus der E-Mail.');
        setState('error');
      }
      setSessionChecked(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle recovery flow: password reset via URL token (type=recovery)
  useEffect(() => {
    if (!isRecovery) return;
    const authPayload = initialAuthPayload;

    const processRecovery = async () => {
      const { session, latestAuthError } = await hydrateSessionFromAuthPayload(supabase, authPayload);
      clearAuthParamsFromUrl();

      if (!session) {
        setErrorText(latestAuthError || 'Passwort-Reset-Link ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.');
        setState('error');
        return;
      }
      setState('needs_password');
    };

    processRecovery().catch(err => {
      setErrorText(err instanceof Error ? err.message : 'Link konnte nicht verarbeitet werden.');
      setState('error');
    });
  }, [isRecovery]);

  const handleRequestCode = async (isResend = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorText('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    setErrorText('');

    if (isResend) {
      setIsRequestingCode(true);
    } else {
      setState('initial'); // Stay in initial to show spinner on the button
      setIsRequestingCode(true);
    }

    const result = await requestOnboardingCode(normalizedEmail);
    setIsRequestingCode(false);

    if (!result.ok) {
      setErrorText(mapRequestCodeError(result.code, result.message, result.secondsRemaining));
      if (result.code === 'RATE_LIMITED' && result.secondsRemaining && result.secondsRemaining > 0) {
        startCooldown(result.secondsRemaining);
        if (!isResend) setState('code_sent');
      }
      return;
    }

    startCooldown(CODE_COOLDOWN_SECONDS);
    setCode('');
    setState('code_sent');
  };

  useEffect(() => {
    if (!sessionChecked || isRecovery || !shouldAutoStartCode) return;
    if (!email || state !== 'initial' || didAutoRequestCodeRef.current) return;

    didAutoRequestCodeRef.current = true;
    void handleRequestCode(false);
  }, [email, isRecovery, shouldAutoStartCode, state, sessionChecked]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.replace(/\D/g, '');

    if (normalizedCode.length !== 6) {
      setErrorText('Bitte geben Sie den 6-stelligen Code aus der E-Mail ein.');
      return;
    }

    setState('verifying');
    setErrorText('');

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: normalizedCode,
      type: 'email',
    });

    if (error) {
      setErrorText('Der eingegebene Code ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Code an.');
      setState('code_sent');
      return;
    }

    setState('needs_password');
  };

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
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;

      if (!isRecovery) {
        await claimMyInvitation();
      }

      setState('success');
      window.setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Passwort konnte nicht gesetzt werden.');
      setState('needs_password');
    }
  };

  const title = isRecovery ? 'Passwort zurücksetzen' : 'Konto einrichten';
  const isCodeButtonDisabled = cooldownSeconds > 0 || isRequestingCode;

  return (
    <AuthScreenShell>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>

      {(state === 'loading' || state === 'verifying' || state === 'saving') && (
        <p className="text-sm text-slate-600">
          {state === 'loading' ? 'Link wird geprüft...' : state === 'verifying' ? 'Code wird geprüft...' : 'Wird gespeichert...'}
        </p>
      )}

      {state === 'error' && (
        <div className="space-y-4">
          <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{errorText}</p>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/');
            }}
            className="inline-flex items-center justify-center w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
          >
            Zur Anmeldung
          </button>
        </div>
      )}

      {/* Step 1: Email + "Code anfordern" */}
      {state === 'initial' && !isRecovery && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {shouldAutoStartCode
              ? 'Wir senden Ihren Bestätigungscode automatisch. Falls nötig können Sie unten erneut anfordern.'
              : 'Fordern Sie Ihren Bestätigungscode an. Die Einladung ist mit folgender E-Mail verknüpft:'}
          </p>
          <div>
            <p className="text-sm font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
              {email}
            </p>
          </div>
          {errorText && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{errorText}</p>}
          <button
            type="button"
            onClick={() => handleRequestCode(false)}
            disabled={isRequestingCode}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-lg font-semibold text-base transition-colors disabled:opacity-50"
          >
            {isRequestingCode ? 'Code wird gesendet...' : 'Code per E-Mail anfordern'}
          </button>
        </div>
      )}

      {/* Step 2: Code entry */}
      {state === 'code_sent' && !isRecovery && (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <p className="text-sm text-slate-600">
            Wir haben einen 6-stelligen Code an <strong>{email}</strong> gesendet.
          </p>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bestätigungscode</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all tracking-widest text-center text-2xl font-mono"
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          {errorText && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{errorText}</p>}

          <button
            type="submit"
            disabled={code.replace(/\D/g, '').length !== 6}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            Weiter
          </button>

          <button
            type="button"
            onClick={() => handleRequestCode(true)}
            disabled={isCodeButtonDisabled}
            className="w-full border border-slate-300 hover:border-slate-400 text-slate-700 px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isRequestingCode
              ? 'Code wird gesendet...'
              : cooldownSeconds > 0
                ? `Neuen Code anfordern (${cooldownSeconds}s)`
                : 'Neuen Code anfordern'}
          </button>
        </form>
      )}

      {/* Step 3: Set password */}
      {state === 'needs_password' && (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <p className="text-sm text-slate-600">
            {isRecovery
              ? 'Legen Sie jetzt ein neues Passwort fest.'
              : 'Legen Sie jetzt Ihr Passwort fest. Danach wird Ihr Zugang aktiviert.'}
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
              autoFocus
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
            />
          </div>
          {errorText && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{errorText}</p>}
          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
          >
            Passwort festlegen
          </button>
        </form>
      )}

      {state === 'success' && (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            {isRecovery ? 'Passwort erfolgreich zurückgesetzt.' : 'Passwort gesetzt. Ihr Zugang wurde aktiviert.'}
          </p>
          <p className="text-sm text-slate-600">Sie werden weitergeleitet...</p>
        </div>
      )}
    </AuthScreenShell>
  );
};

export default AcceptInvite;
