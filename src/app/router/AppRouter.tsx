import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { Bus } from 'lucide-react';
import { supabase } from '../../shared/lib/supabase';
import { useAuth } from '../../shared/auth/AuthContext';
import AuthScreenShell from '../../shared/components/auth/AuthScreenShell';
import { useToast } from '../../shared/components/ToastProvider';
import { ProfileSecurityApi } from '../../shared/api/profile/profileSecurity.api';
import AppLoadingBridge, { RouteLoadingFallback } from '../../shared/loading/AppLoadingBridge';
import AuthCallbackNormalizer from './AuthCallbackNormalizer';

const Home = lazy(() => import('../../features/home/pages/HomePage'));
const PlatformAdmin = lazy(() => import('../../features/admin/platform/pages/PlatformAdminPage'));
const TeamAdmin = lazy(() => import('../../features/admin/team/pages/TeamAdminPage'));
const Profile = lazy(() => import('../../features/profile/pages/ProfilePage'));
const AcceptInvite = lazy(() => import('../../features/auth/pages/AcceptInvitePage'));
const AccountSecurity = lazy(() => import('../../features/auth/pages/AccountSecurityPage'));
const Register = lazy(() => import('../../features/auth/pages/RegisterPage'));
const BusflowApp = lazy(() => import('../../features/busflow/pages/BusflowAppPage'));

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
  onForgotPassword,
}) => (
  <AuthScreenShell>
    <h2 className="text-2xl font-bold text-slate-900 mb-2">Anmeldung</h2>
    <p className="text-sm text-slate-500 mb-6">Bitte melden Sie sich an, um fortzufahren.</p>
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
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
          onChange={e => onPasswordChange(e.target.value)}
          className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white/80 border transition-all"
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
      Noch kein Account?{' '}
      <Link to="/auth/register" className="font-semibold text-blue-700 hover:text-blue-600">
        Jetzt registrieren
      </Link>
      .
    </div>
  </AuthScreenShell>
);

const AppRouter: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeAccountId, activeAccount, canManageTenantUsers, loading, logout } = useAuth();
  const { pushToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const [profileEmailDraft, setProfileEmailDraft] = useState('');
  const [profileAvatarUrlDraft, setProfileAvatarUrlDraft] = useState('');
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isAvatarSubmitting, setIsAvatarSubmitting] = useState(false);

  useEffect(() => {
    setProfileEmailDraft(user?.email || '');
    setProfileAvatarUrlDraft(user?.avatarUrl || '');
  }, [user?.id, user?.email, user?.avatarUrl]);

  const isValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const canRequestEmailChange =
    isValidEmailFormat(profileEmailDraft.trim()) &&
    profileEmailDraft.trim().toLowerCase() !== (user?.email || '').toLowerCase();

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
      const redirectTo =
        (import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL as string | undefined)?.trim() ||
        `${window.location.origin}/auth/accept-invite`;

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

  const handleProfileAvatarSave = async () => {
    if (isAvatarSubmitting || !user) return;
    setIsAvatarSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: profileAvatarUrlDraft || null })
        .eq('id', user.id);
      if (error) throw error;
      pushToast({ type: 'success', title: 'Profilbild gespeichert', message: 'Das Profilbild wurde aktualisiert.' });
    } catch {
      pushToast({ type: 'error', title: 'Fehler', message: 'Profilbild konnte nicht gespeichert werden.' });
    } finally {
      setIsAvatarSubmitting(false);
    }
  };

  const handleProfileEmailChangeRequest = async () => {
    if (isEmailSubmitting || !user || !canRequestEmailChange) return;
    setIsEmailSubmitting(true);
    try {
      await ProfileSecurityApi.requestEmailChange(profileEmailDraft.trim().toLowerCase());
      setProfileEmailDraft(user.email || '');
      pushToast({
        type: 'info',
        title: 'Bestätigung gesendet',
        message: 'Bitte bestätigen Sie die E-Mail-Änderung über die versendeten E-Mails.',
      });
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'E-Mail-Änderung fehlgeschlagen',
        message: error instanceof Error ? error.message : 'E-Mail-Änderung konnte nicht angefordert werden.',
      });
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handleProfilePasswordResetRequest = async () => {
    if (isPasswordSubmitting) return;
    setIsPasswordSubmitting(true);
    try {
      await ProfileSecurityApi.requestPasswordReset();
      pushToast({
        type: 'info',
        title: 'Reset-Link gesendet',
        message: 'Ein Passwort-Reset-Link wurde an Ihre aktuelle E-Mail gesendet.',
      });
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Passwort-Reset fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Passwort-Reset konnte nicht angefordert werden.',
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const adminPath = canManageTenantUsers ? '/adminbereich' : '/';
  const ownerPath = user?.isPlatformOwner ? '/owner-bereich' : adminPath;
  const goAdmin = () => navigate(adminPath);
  const goOwner = () => navigate(ownerPath);
  const suspenseFallback = <RouteLoadingFallback message="Lade..." />;

  if (loading) {
    return (
      <>
        <AppLoadingBridge authLoading={loading} />
        <div className="min-h-screen bg-slate-50" />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AppLoadingBridge authLoading={loading} />
        <AuthCallbackNormalizer />
        <Suspense fallback={suspenseFallback}>
          <Routes>
            <Route path="/auth/accept-invite" element={<AcceptInvite />} />
            <Route path="/auth/account-security" element={<AccountSecurity />} />
            <Route path="/auth/register" element={<Register />} />
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
                  onEmailChange={value => {
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
        </Suspense>
      </>
    );
  }

  const isAcceptInviteRoute = location.pathname === '/auth/accept-invite';

  if (!user.isPlatformAdmin && !activeAccountId && !isAcceptInviteRoute) {
    return (
      <AuthScreenShell>
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Konto-Zugang ausstehend</h2>
          <p className="text-sm text-slate-600">
            Ihr Konto-Zugang wurde noch nicht vollständig aktiviert. Klicken Sie auf die Schaltfläche unten, um den
            Aktivierungsprozess abzuschließen.
          </p>
          <Link
            to="/auth/accept-invite"
            className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors text-sm"
          >
            Zugang aktivieren
          </Link>
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
      </AuthScreenShell>
    );
  }

  const apps = [
    {
      id: 'busflow',
      title: 'BusPilot Routenplanung',
      description: 'Routen, Halte, Fahrgastzahlen und Druckansicht verwalten.',
      icon: Bus,
      onClick: () => navigate('/busflow'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AppLoadingBridge authLoading={loading} />
      <AuthCallbackNormalizer />
      <Suspense fallback={suspenseFallback}>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                apps={apps}
                auth={user}
                activeAccount={activeAccount}
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
                    onLogout: handleLogout,
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
                    onLogout: handleLogout,
                  }}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/owner-settings"
            element={<Navigate to={user.isPlatformOwner ? '/owner-bereich' : '/adminbereich'} replace />}
          />
          <Route path="/company-settings" element={<Navigate to={canManageTenantUsers ? '/adminbereich' : '/'} replace />} />
          <Route path="/team-admin" element={<Navigate to={canManageTenantUsers ? '/adminbereich' : '/'} replace />} />
          <Route
            path="/platform-admin"
            element={<Navigate to={user.isPlatformOwner ? '/owner-bereich' : '/adminbereich'} replace />}
          />
          <Route path="/admin" element={<Navigate to={canManageTenantUsers ? '/adminbereich' : '/'} replace />} />
          <Route path="/auth/accept-invite" element={<AcceptInvite />} />
          <Route path="/auth/account-security" element={<AccountSecurity />} />
          <Route
            path="/profile"
            element={
              <Profile
                name={user.name}
                role={user.role}
                avatarUrl={user.avatarUrl}
                isPlatformOwner={user.isPlatformOwner}
                email={user.email || ''}
                profileEmail={profileEmailDraft}
                profileAvatarUrl={profileAvatarUrlDraft}
                onEmailChange={setProfileEmailDraft}
                onAvatarChange={setProfileAvatarUrlDraft}
                onSaveAvatar={handleProfileAvatarSave}
                onRequestEmailChange={handleProfileEmailChangeRequest}
                onRequestPasswordReset={handleProfilePasswordResetRequest}
                canRequestEmailChange={canRequestEmailChange}
                isEmailSubmitting={isEmailSubmitting}
                isPasswordSubmitting={isPasswordSubmitting}
                isAvatarSubmitting={isAvatarSubmitting}
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
      </Suspense>
    </div>
  );
};

export default AppRouter;
