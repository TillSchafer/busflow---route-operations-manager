import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bus, Leaf } from 'lucide-react';
import { supabase } from './shared/lib/supabase';
import Home from './pages/Home';
import PlatformAdmin from './pages/PlatformAdmin';
import TeamAdmin from './pages/TeamAdmin';
import Profile from './pages/Profile';
import AcceptInvite from './pages/AcceptInvite';
import BusflowApp from './apps/busflow/BusflowApp';
import { AuthProvider, useAuth } from './shared/auth/AuthContext';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { ToastProvider } from './shared/components/ToastProvider';
import ToastViewport from './shared/components/ToastViewport';
import { useToast } from './shared/components/ToastProvider';
import { ProgressProvider } from './shared/components/ProgressProvider';
import ProgressViewport from './shared/components/ProgressViewport';

const LoginScreen: React.FC<{
  email: string;
  password: string;
  loginError: string;
  resetMessage: string;
  isLoggingIn: boolean;
  isSendingReset: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onForgotPassword: () => Promise<void>;
}> = ({
  email,
  password,
  loginError,
  resetMessage,
  isLoggingIn,
  isSendingReset,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword
}) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-8 py-8 w-full max-w-md">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Anmeldung</h2>
      <p className="text-sm text-slate-500 mb-6">
        Bitte melden Sie sich an, um fortzufahren.
        <br />
        <span className="font-medium text-slate-700">Zugang nur per Einladung.</span>
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
            placeholder="name@firma.de"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>
        {loginError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{loginError}</p>}
        {resetMessage && <p className="text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{resetMessage}</p>}

        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {isLoggingIn ? 'Verarbeite...' : 'Anmelden'}
        </button>

        <button
          type="button"
          disabled={isSendingReset}
          onClick={onForgotPassword}
          className="w-full text-sm font-semibold text-blue-700 hover:text-blue-600 disabled:opacity-50"
        >
          {isSendingReset ? 'Sende Reset-Link...' : 'Passwort vergessen?'}
        </button>
      </form>

      <div className="mt-4 text-sm text-slate-600">
        Noch kein Passwort gesetzt?{' '}
        <Link to="/auth/accept-invite" className="font-semibold text-blue-700 hover:text-blue-600">
          Einladungslink öffnen und Passwort festlegen
        </Link>
        .
      </div>
    </div>
  </div>
);

const InnerApp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeAccountId, canManageTenantUsers, loading, logout } = useAuth();
  const { pushToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error: unknown) {
      const fallbackMessage = 'Anmeldung fehlgeschlagen.';
      setLoginError(error instanceof Error ? error.message || fallbackMessage : fallbackMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setLoginError('Bitte zuerst Ihre E-Mail-Adresse eingeben.');
      return;
    }

    setIsSendingReset(true);
    setResetMessage('');

    try {
      const redirectTo = (import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL as string | undefined)?.trim()
        || `${window.location.origin}/auth/accept-invite`;

      await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    } catch {
      // Neutral response on purpose to avoid account enumeration.
    } finally {
      setIsSendingReset(false);
      setResetMessage('Wenn ein passendes Konto existiert, wurde ein Reset-Link per E-Mail versendet.');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const adminPath = canManageTenantUsers ? '/adminbereich' : '/';
  const ownerPath = user?.isPlatformOwner ? '/owner-bereich' : adminPath;
  const goAdmin = () => navigate(adminPath);
  const goOwner = () => navigate(ownerPath);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Leaf className="w-8 h-8 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Lade ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth/accept-invite" element={<AcceptInvite />} />
        <Route
          path="*"
          element={
            <LoginScreen
              email={email}
              password={password}
              loginError={loginError}
              resetMessage={resetMessage}
              isLoggingIn={isLoggingIn}
              isSendingReset={isSendingReset}
              onEmailChange={(value) => {
                setEmail(value);
                setResetMessage('');
              }}
              onPasswordChange={setPassword}
              onSubmit={handleAuth}
              onForgotPassword={handleForgotPassword}
            />
          }
        />
      </Routes>
    );
  }

  const isAcceptInviteRoute = location.pathname === '/auth/accept-invite';

  if (!user.isPlatformAdmin && !activeAccountId && !isAcceptInviteRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-8 py-8 w-full max-w-md text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Konto-Zugang ausstehend</h2>
          <p className="text-sm text-slate-600">
            Ihr Konto ist noch nicht vollständig aktiviert. Bitte öffnen Sie den Einladungslink aus Ihrer E-Mail und setzen Sie dort Ihr Passwort, um den Zugang abzuschließen.
          </p>
          <a
            href="/auth/accept-invite"
            className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors text-sm"
          >
            Einladungslink öffnen
          </a>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-700 font-semibold"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
    );
  }

  const apps = [
    {
      id: 'busflow',
      title: 'BusFlow Routenplanung',
      description: 'Routen, Halte, Fahrgastzahlen und Druckansicht verwalten.',
      icon: Bus,
      onClick: () => navigate('/busflow')
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Routes>
        <Route
          path="/"
          element={
            <Home
              apps={apps}
              auth={user}
              onProfile={() => navigate('/profile')}
              onAdmin={goAdmin}
              onOwner={user.isPlatformOwner ? goOwner : undefined}
              onLogout={handleLogout}
              onHome={() => navigate('/')}
            />
          }
        />
        <Route
          path="/busflow"
          element={
            <BusflowApp
              authUser={user}
              activeAccountId={activeAccountId}
              onProfile={() => navigate('/profile')}
              onLogout={handleLogout}
              onGoHome={() => navigate('/')}
              onAdmin={goAdmin}
              onOwner={user.isPlatformOwner ? goOwner : undefined}
            />
          }
        />
        <Route
          path="/owner-bereich"
          element={
            user.isPlatformOwner ? (
              <PlatformAdmin
                header={{
                  title: 'Owner Bereich',
                  user: user,
                  onHome: () => navigate('/'),
                  onProfile: () => navigate('/profile'),
                  onAdmin: goAdmin,
                  onOwner: goOwner,
                  onLogout: handleLogout
                }}
              />
            ) : (
              <Navigate to={canManageTenantUsers ? '/adminbereich' : '/'} replace />
            )
          }
        />
        <Route
          path="/adminbereich"
          element={
            canManageTenantUsers ? (
              <TeamAdmin
                currentUserId={user.id}
                activeAccountId={activeAccountId}
                header={{
                  title: 'Adminbereich',
                  user: user,
                  onHome: () => navigate('/'),
                  onProfile: () => navigate('/profile'),
                  onAdmin: goAdmin,
                  onOwner: user.isPlatformOwner ? goOwner : undefined,
                  onLogout: handleLogout
                }}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/owner-settings" element={<Navigate to={user.isPlatformOwner ? '/owner-bereich' : '/adminbereich'} replace />} />
        <Route path="/company-settings" element={<Navigate to={canManageTenantUsers ? '/adminbereich' : '/'} replace />} />
        <Route path="/team-admin" element={<Navigate to={canManageTenantUsers ? '/adminbereich' : '/'} replace />} />
        <Route path="/platform-admin" element={<Navigate to={user.isPlatformOwner ? '/owner-bereich' : '/adminbereich'} replace />} />
        <Route path="/admin" element={<Navigate to={canManageTenantUsers ? '/adminbereich' : '/'} replace />} />
        <Route
          path="/auth/accept-invite"
          element={<AcceptInvite />}
        />
        <Route
          path="/profile"
          element={
            <Profile
              name={user.name}
              role={user.role}
              avatarUrl={user.avatarUrl}
              isPlatformOwner={user.isPlatformOwner}
              email={user.email || ''}
              profileEmail={user.email || ''}
              profileAvatarUrl={user.avatarUrl || ''}
              profilePassword=""
              onEmailChange={() => { }}
              onAvatarChange={() => { }}
              onPasswordChange={() => { }}
              onSave={() => pushToast({ type: 'info', title: 'Info', message: 'Profil-Speichern wird in einer späteren Phase angebunden.' })}
              onGoHome={() => navigate('/')}
              onLogout={handleLogout}
              onProfile={() => navigate('/profile')}
              onAdmin={goAdmin}
              onOwner={user.isPlatformOwner ? goOwner : undefined}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProgressProvider>
          <InnerApp />
          <ProgressViewport />
          <ToastViewport />
          <SpeedInsights />
          <Analytics />
        </ProgressProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
