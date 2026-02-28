import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthScreenShell from '../../../shared/components/auth/AuthScreenShell';
import { supabase } from '../../../shared/lib/supabase';
import { PublicRegisterApi, PublicRegisterError } from '../../../shared/api/public/registerTrial.api';

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const PASSWORD_POLICY_MESSAGE =
  'Das Passwort muss mindestens 12 Zeichen lang sein und Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.';
const meetsPasswordPolicy = (value: string) =>
  value.length >= 12 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

const mapRegisterError = (error: unknown): string => {
  if (error instanceof PublicRegisterError) {
    if (error.code === 'EMAIL_ALREADY_REGISTERED') {
      return 'Diese E-Mail ist bereits registriert. Bitte melden Sie sich an oder nutzen Sie „Passwort vergessen“.';
    }
    if (error.code === 'RATE_LIMITED') {
      return 'Zu viele Registrierungsversuche. Bitte versuchen Sie es später erneut.';
    }
    if (error.code === 'INVALID_INPUT') {
      return 'Bitte alle Pflichtfelder korrekt ausfüllen.';
    }
    if (error.code === 'REGISTRATION_SEED_FAILED') {
      return 'Registrierung konnte nicht vorbereitet werden. Bitte erneut versuchen.';
    }

    return error.message;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('already registered') || message.includes('already exists')) {
      return 'Diese E-Mail ist bereits registriert. Bitte melden Sie sich an oder nutzen Sie „Passwort vergessen“.';
    }
    if (message.includes('email rate limit')) {
      return 'Bitte warten Sie kurz, bevor Sie es erneut versuchen.';
    }
    if (message.includes('at least 12 characters') || message.includes('should contain at least one character of each')) {
      return PASSWORD_POLICY_MESSAGE;
    }

    return error.message;
  }

  return 'Registrierung konnte nicht abgeschlossen werden.';
};

const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [showResendHint, setShowResendHint] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorText('');
    setSuccessText('');
    setShowResendHint(false);

    const normalizedEmail = normalizeEmail(email);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorText('Bitte einen gültigen Namen eingeben.');
      return;
    }

    if (!companyName.trim() || companyName.trim().length < 2) {
      setErrorText('Bitte einen gültigen Firmennamen eingeben.');
      return;
    }

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorText('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }

    if (!meetsPasswordPolicy(password)) {
      setErrorText(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (password !== passwordConfirm) {
      setErrorText('Die Passwörter stimmen nicht überein.');
      return;
    }

    setIsSubmitting(true);

    try {
      const seedResult = await PublicRegisterApi.seedTrialRegistration({
        fullName: fullName.trim(),
        companyName: companyName.trim(),
        email: normalizedEmail,
        honeypot: website,
      });

      const redirectTo = (import.meta.env.VITE_INVITE_ACCEPT_REDIRECT_URL as string | undefined)?.trim()
        || `${window.location.origin}/auth/accept-invite`;
      const { error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: redirectTo,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (seedResult.code === 'REGISTRATION_REUSED_PENDING' || seedResult.reusedPending) {
        setSuccessText('Es besteht bereits eine offene Registrierung. Wir haben einen neuen Bestätigungslink angefordert. Bitte prüfen Sie Ihr Postfach.');
      } else {
        setSuccessText('Bitte prüfen Sie Ihr E-Mail-Postfach und bestätigen Sie den Link, um die Registrierung abzuschließen.');
      }
      setShowResendHint(true);
      setPassword('');
      setPasswordConfirm('');
      setWebsite('');
    } catch (error) {
      setErrorText(mapRegisterError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Registrieren</h2>
        <p className="text-sm text-slate-500 mb-6">
          Erstellen Sie Ihren Account und starten Sie mit der 14-Tage-Testphase.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Ihr Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
              placeholder="Max Mustermann"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Firmenname</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
              placeholder="Muster Logistik GmbH"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
              placeholder="name@firma.de"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
              placeholder="Mindestens 12 Zeichen inkl. Sonderzeichen"
              minLength={12}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Passwort wiederholen</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
              minLength={12}
              required
            />
          </div>

          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              autoComplete="off"
              tabIndex={-1}
            />
          </div>

          {errorText && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{errorText}</p>}
          {successText && <p className="text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{successText}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Registriere...' : 'Jetzt registrieren'}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          Bereits registriert?{' '}
          <Link to="/" className="font-semibold text-blue-700 hover:text-blue-600">
            Zur Anmeldung
          </Link>
          .
        </div>
        {showResendHint && (
          <div className="mt-2 text-sm text-slate-600">
            Kein Link erhalten? Prüfen Sie Spam/Junk und klicken Sie danach erneut auf{' '}
            <span className="font-semibold">Jetzt registrieren</span>, um die Bestätigungs-Mail erneut zu senden.
          </div>
        )}
    </AuthScreenShell>
  );
};

export default Register;
