import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Bus, Leaf } from 'lucide-react';
import { supabase } from './shared/lib/supabase';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import BusflowApp from './apps/busflow/BusflowApp';
import { AuthProvider, useAuth } from './shared/auth/AuthContext';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { ToastProvider } from './shared/components/ToastProvider';
import ToastViewport from './shared/components/ToastViewport';
import { useToast } from './shared/components/ToastProvider';
import { ProgressProvider } from './shared/components/ProgressProvider';
import ProgressViewport from './shared/components/ProgressViewport';

const InnerApp: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeAccountId, loading, logout } = useAuth();
  const { pushToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-8 py-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Anmeldung</h2>
          <p className="text-sm text-slate-500 mb-6">
            Bitte melden Sie sich an, um fortzufahren.
            <br />
            <span className="font-medium text-slate-700">Zugang nur per Einladung.</span>
          </p>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
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
                onChange={e => setPassword(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {loginError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{loginError}</p>}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? 'Verarbeite...' : 'Anmelden'}
            </button>
          </form>
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
      // For now, simpler access check
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
              onAdmin={() => navigate('/admin')}
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
              onAdmin={() => navigate('/admin')}
            />
          }
        />
        <Route
          path="/admin"
          element={
            user.role === 'ADMIN' ? (
              <Admin
                apps={apps}
                currentUserId={user.id}
                activeAccountId={activeAccountId}
                isPlatformAdmin={user.isPlatformAdmin}
                header={{
                  title: 'Adminbereich',
                  user: user,
                  onHome: () => navigate('/'),
                  onProfile: () => navigate('/profile'),
                  onAdmin: () => navigate('/admin'),
                  onLogout: handleLogout
                }}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/profile"
          element={
            <Profile
              name={user.name}
              role={user.role}
              avatarUrl={user.avatarUrl}
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
              onAdmin={() => navigate('/admin')}
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
