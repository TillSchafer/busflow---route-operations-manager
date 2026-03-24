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
import { DizpoShell } from '../../shared/components/BusFlowShell';

const Home = lazy(() => import('../../features/home/pages/HomePage'));
const PlatformAdmin = lazy(() => import('../../features/admin/platform/pages/PlatformAdminPage'));
const TeamAdmin = lazy(() => import('../../features/admin/team/pages/TeamAdminPage'));
const Profile = lazy(() => import('../../features/profile/pages/ProfilePage'));
const AcceptInvite = lazy(() => import('../../features/auth/pages/AcceptInvitePage'));
const AccountSecurity = lazy(() => import('../../features/auth/pages/AccountSecurityPage'));
const Register = lazy(() => import('../../features/auth/pages/RegisterPage'));
const DizpoApp = lazy(() => import('../../features/busflow/pages/BusflowAppPage'));
const MapPage = lazy(() => import('../../features/map/pages/MapPage'));

const LoginScreen: React.FC<{
  email: string;
  password: string;
  authMessage: { type: 'error' | 'info'; text: string } | null;
  isLoggingIn: boolean;
  isSendingReset: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onForgotPassword: () => Promise<void>;
}> = ({
  email,
  password,
  authMessage,
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

      {authMessage && (
        <p
          role="alert"
          className={`text-sm font-semibold ${
            authMessage.type === 'error' ? 'text-red-600' : 'text-emerald-700'
          }`}
        >
          {authMessage.text}
        </p>
      )}
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

const mapLoginError = (error: unknown): string => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials') || msg.includes('user not found')) {
      return 'E-Mail-Adresse oder Passwort ist falsch.';
    }
    if (msg.includes('email not confirmed')) {
      return 'E-Mail-Adresse noch nicht bestätigt. Bitte prüfen Sie Ihr Postfach.';
    }
    if (msg.includes('too many requests') || msg.includes('rate limit')) {
      return 'Zu viele Anmeldeversuche. Bitte warten Sie kurz.';
    }
  }
  return 'Anmeldung fehlgeschlagen.';
};

const hasAuthCallbackParam = (params: URLSearchParams): boolean =>
  [
    'token',
    'token_hash',
    'code',
    'access_token',
    'refresh_token',
    'type',
    'error',
    'error_code',
    'error_description',
  ].some(key => params.has(key));

const AppRouter: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeAccountId, activeAccount, canManageTenantUsers, loading, logout } = useAuth();
  const { pushToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

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
    setAuthMessage(null);
    setIsLoggingIn(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error: unknown) {
      const message = mapLoginError(error);
      setAuthMessage({ type: 'error', text: message });
      pushToast({ type: 'error', title: 'Anmelden fehlgeschlagen', message });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      const message = 'Bitte zuerst Ihre E-Mail-Adresse eingeben.';
      setAuthMessage({ type: 'error', text: message });
      pushToast({ type: 'error', title: 'E-Mail fehlt', message });
      return;
    }

    setAuthMessage(null);
    setIsSendingReset(true);

    try {
      const redirectTo =
        (import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL as string | undefined)?.trim() ||
        `${window.location.origin}/auth/accept-invite`;

      await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    } catch {
      // Neutral response on purpose to avoid account enumeration.
    } finally {
      setIsSendingReset(false);
      const message = 'Wenn ein passendes Konto existiert, wurde ein Reset-Link per E-Mail versendet.';
      setAuthMessage({ type: 'info', text: message });
      pushToast({ type: 'success', title: 'Reset-Link gesendet', message });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleProfileAvatarSave = async () => {
    if (isAvatarSubmitting || !user) return;
    const trimmedUrl = profileAvatarUrlDraft.trim();
    if (trimmedUrl) {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== 'https:') throw new Error();
      } catch {
        pushToast({ type: 'error', title: 'Ungültige URL', message: 'Profilbild-URL muss mit https:// beginnen.' });
        return;
      }
    }
    setIsAvatarSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: trimmedUrl || null })
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
  const suspenseFallback = <RouteLoadingFallback />;

  if (loading) {
    return (
      <>
        <AppLoadingBridge authLoading={loading} messageKey="auth.bootstrap" />
        <div className="min-h-screen bg-slate-50" />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AppLoadingBridge authLoading={loading} messageKey="auth.bootstrap" />
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
                  authMessage={authMessage}
                  isLoggingIn={isLoggingIn}
                  isSendingReset={isSendingReset}
                  onEmailChange={setEmail}
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
  const isAccountSecurityRoute = location.pathname === '/auth/account-security';
  const searchParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash);
  const hasPendingAuthCallback = hasAuthCallbackParam(searchParams) || hasAuthCallbackParam(hashParams);

  if (!user.isPlatformAdmin && !activeAccountId && !isAcceptInviteRoute && !isAccountSecurityRoute && !hasPendingAuthCallback) {
    return (
      <>
        <AuthCallbackNormalizer />
        <Navigate to="/auth/accept-invite" replace />
      </>
    );
  }

  const apps = [
    {
      id: 'dizpo',
      title: 'Dizpo Routenplanung',
      description: 'Routen, Halte, Fahrgastzahlen und Druckansicht verwalten.',
      icon: Bus,
      onClick: () => navigate('/dizpo'),
      onMouseEnter: () => import('../../features/busflow/pages/BusflowAppPage'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AppLoadingBridge authLoading={loading} messageKey="auth.bootstrap" />
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
          <Route element={<DizpoShell />}>
            <Route
              path="/dizpo"
              element={
                activeAccountId ? (
                  <DizpoApp
                    authUser={user}
                    activeAccountId={activeAccountId}
                    onProfile={() => navigate('/profile')}
                    onLogout={handleLogout}
                    onGoHome={() => navigate('/')}
                    onAdmin={goAdmin}
                    onOwner={user.isPlatformOwner ? goOwner : undefined}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/karte"
              element={activeAccountId ? <MapPage /> : <Navigate to="/" replace />}
            />
          </Route>
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
