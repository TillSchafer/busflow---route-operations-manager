import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthScreenShell from '../../../shared/components/auth/AuthScreenShell';
import { PublicRegisterApi, PublicRegisterError } from '../../../shared/api/public/registerTrial.api';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const mapRegisterError = (error: unknown): string => {
  if (error instanceof PublicRegisterError) {
    switch (error.code) {
      case 'EMAIL_ALREADY_REGISTERED':
        return 'Diese E-Mail ist bereits registriert. Bitte melden Sie sich an oder nutzen Sie „Passwort vergessen“.';
      case 'RATE_LIMITED':
        return 'Zu viele Registrierungsversuche. Bitte versuchen Sie es später erneut.';
      case 'INVALID_INPUT':
        return 'Bitte alle Pflichtfelder korrekt ausfüllen.';
      case 'REGISTRATION_SEED_FAILED':
        return 'Registrierung konnte nicht abgeschlossen werden. Bitte erneut versuchen.';
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('already registered') || message.includes('already exists')) {
      return 'Diese E-Mail ist bereits registriert. Bitte melden Sie sich an oder nutzen Sie „Passwort vergessen“.';
    }
    return error.message;
  }

  return 'Registrierung konnte nicht abgeschlossen werden.';
};

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    const normalizedEmail = normalizeEmail(email);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setFormError('Bitte einen gültigen Namen eingeben.');
      return;
    }
    if (!companyName.trim() || companyName.trim().length < 2) {
      setFormError('Bitte einen gültigen Firmennamen eingeben.');
      return;
    }
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setFormError('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }

    setIsSubmitting(true);

    try {
      await PublicRegisterApi.seedTrialRegistration({
        fullName: fullName.trim(),
        companyName: companyName.trim(),
        email: normalizedEmail,
        honeypot: website,
      });
      navigate(`/auth/accept-invite?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (error) {
      setFormError(mapRegisterError(error));
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

      <form onSubmit={handleFormSubmit} className="space-y-4">
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

        {formError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Weiter...' : 'Weiter'}
        </button>
      </form>

      <div className="mt-4 text-sm text-slate-600">
        Bereits registriert?{' '}
        <Link to="/" className="font-semibold text-blue-700 hover:text-blue-600">
          Zur Anmeldung
        </Link>
        .
      </div>
    </AuthScreenShell>
  );
};

export default Register;
