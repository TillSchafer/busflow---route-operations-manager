import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../shared/lib/supabase';
import AuthScreenShell from '../../../shared/components/auth/AuthScreenShell';

type ViewState =
  | 'initial'         // Email input + "Code anfordern" button
  | 'code_sent'       // Code input visible, cooldown running
  | 'verifying'       // verifyOtp in progress
  | 'needs_password'  // New password form
  | 'saving'          // updateUser in progress
  | 'error';          // Unrecoverable error

const CODE_COOLDOWN_SECONDS = 60;

const getEmailFromUrl = (): string =>
  new URLSearchParams(window.location.search).get('email')?.trim().toLowerCase() || '';

const persistEmailInUrl = (email: string) => {
  const params = new URLSearchParams(window.location.search);
  params.set('email', email);
  window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
};

const PasswordResetPage: React.FC = () => {
  const didCheckSessionRef = useRef(false);

  const [state, setState] = useState<ViewState>('initial');
  const [email, setEmail] = useState(getEmailFromUrl);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorText, setErrorText] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isRequestingCode, setIsRequestingCode] = useState(false);

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

  // On mount: check for an existing session (happens after OTP verify causes a component remount).
  useEffect(() => {
    if (didCheckSessionRef.current) return;
    didCheckSessionRef.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;

      const emailInUrl = getEmailFromUrl();
      if (emailInUrl) {
        setEmail(emailInUrl);
        setState('needs_password');
      } else {
        // Session exists but no reset context — sign out and go to login.
        supabase.auth.signOut().then(() => window.location.assign('/'));
      }
    });
  }, []);

  const handleRequestCode = async (isResend = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorText('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }

    setErrorText('');
    setIsRequestingCode(true);

    // Preserve email in URL so it survives a component remount after OTP verify.
    persistEmailInUrl(normalizedEmail);

    // Neutral response regardless of result — prevents account enumeration.
    // shouldCreateUser: false means Supabase won't create a new user.
    await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false },
    });

    setIsRequestingCode(false);
    if (!isResend) setCode('');
    startCooldown(CODE_COOLDOWN_SECONDS);
    setState('code_sent');
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.replace(/\D/g, '');

    if (normalizedCode.length !== 6) {
      setErrorText('Bitte den 6-stelligen Code aus der E-Mail eingeben.');
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
      setErrorText('Der Code ist ungültig oder abgelaufen. Bitte neuen Code anfordern.');
      setState('code_sent');
      return;
    }

    // OTP verified — user now has a session.
    // AppRouter may remount this component; the session check in useEffect handles that case.
    // Setting state here covers the case where no remount occurs.
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Use a full-page reload to '/' instead of React router's navigate().
      // This avoids redirect issues that occur while auth state is transitioning
      // after updateUser fires the USER_UPDATED event (which re-triggers AuthContext).
      window.location.assign('/');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Passwort konnte nicht gesetzt werden.');
      setState('needs_password');
    }
  };

  const isCodeButtonDisabled = cooldownSeconds > 0 || isRequestingCode;

  return (
    <AuthScreenShell>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Passwort zurücksetzen</h2>

      {(state === 'verifying' || state === 'saving') && (
        <p className="text-sm text-slate-600">
          {state === 'verifying' ? 'Code wird geprüft...' : 'Passwort wird gespeichert...'}
        </p>
      )}

      {/* Step 1: Email input + request code */}
      {state === 'initial' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 mb-6">
            Geben Sie Ihre E-Mail-Adresse ein. Wir schicken Ihnen einen 6-stelligen Code.
          </p>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
              placeholder="name@firma.de"
              autoFocus
              required
            />
          </div>
          {errorText && <p className="text-sm text-red-700 bg-red-50 p-2 rounded">{errorText}</p>}
          <button
            type="button"
            onClick={() => handleRequestCode(false)}
            disabled={isRequestingCode}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isRequestingCode ? 'Code wird gesendet...' : 'Code per E-Mail anfordern'}
          </button>
          <div className="text-sm text-slate-600 text-center">
            <Link to="/" className="font-semibold text-blue-700 hover:text-blue-600">
              Zurück zur Anmeldung
            </Link>
          </div>
        </div>
      )}

      {/* Step 2: Code entry */}
      {state === 'code_sent' && (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <p className="text-sm text-slate-600">
            Wir haben einen 6-stelligen Code an <strong>{email}</strong> gesendet.
            Falls Sie kein Konto mit dieser Adresse haben, erhalten Sie keine E-Mail.
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

          <div className="text-sm text-slate-600 text-center">
            <button
              type="button"
              onClick={() => { setState('initial'); setErrorText(''); }}
              className="font-semibold text-blue-700 hover:text-blue-600"
            >
              Andere E-Mail verwenden
            </button>
          </div>
        </form>
      )}

      {/* Step 3: New password */}
      {state === 'needs_password' && (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <p className="text-sm text-slate-600">Legen Sie jetzt Ihr neues Passwort fest.</p>
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
    </AuthScreenShell>
  );
};

export default PasswordResetPage;
