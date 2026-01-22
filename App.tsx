import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Bus, Leaf } from 'lucide-react';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import BusflowApp from './apps/BusflowApp';

const AUTH_KEY = 'busflow_auth_v1';
const USERS_KEY = 'busflow_users_v1';

type Role = 'ADMIN' | 'DISPATCH' | 'VIEWER';

type User = {
  id: string;
  name: string;
  password: string;
  role: Role;
  email?: string;
  avatarUrl?: string;
  allowedApps?: string[];
};

type AuthUser = {
  id: string;
  name: string;
  role: Role;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('DISPATCH');

  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profilePassword, setProfilePassword] = useState('');

  useEffect(() => {
    const savedAuth = localStorage.getItem(AUTH_KEY);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        if (parsed?.name && parsed?.role) {
          const id = parsed.id || parsed.name;
          setAuth({ id, name: parsed.name, role: parsed.role });
        }
      } catch (error) {
        console.warn('Gespeicherte Anmeldung konnte nicht geladen werden.', error);
      }
    }
  }, []);

  useEffect(() => {
    const savedUsers = localStorage.getItem(USERS_KEY);
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((user: any, index: number) => ({
            id: String(user.id ?? index),
            name: String(user.name ?? '').trim(),
            password: typeof user.password === 'string' && user.password.trim()
              ? user.password.trim()
              : 'admin123',
            role: user.role === 'ADMIN' || user.role === 'DISPATCH' || user.role === 'VIEWER'
              ? user.role
              : 'DISPATCH',
            email: typeof user.email === 'string' ? user.email : '',
            avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : '',
            allowedApps: Array.isArray(user.allowedApps) ? user.allowedApps : undefined
          }));
          const filtered = normalized.filter(user => user.name);
          if (filtered.length > 0) {
            setUsers(filtered);
            setUsersLoaded(true);
            return;
          }
        }
      } catch (error) {
        console.warn('Gespeicherte Benutzer konnten nicht geladen werden.', error);
      }
    }
    const defaultAdmin: User = {
      id: 'admin',
      name: 'Admin',
      password: 'admin123',
      role: 'ADMIN',
      email: '',
      avatarUrl: '',
      allowedApps: ['busflow']
    };
    setUsers([defaultAdmin]);
    localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin]));
    setUsersLoaded(true);
  }, []);

  useEffect(() => {
    if (!usersLoaded) return;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users, usersLoaded]);

  const currentUser = auth ? users.find(user => user.id === auth.id) : undefined;

  useEffect(() => {
    if (!currentUser) return;
    setProfileEmail(currentUser.email || '');
    setProfileAvatarUrl(currentUser.avatarUrl || '');
    setProfilePassword('');
  }, [currentUser]);

  const handleLogin = () => {
    setLoginError('');
    const name = loginName.trim();
    const password = loginPassword.trim();
    if (!name || !password) {
      setLoginError('Bitte Name und Passwort eingeben.');
      return;
    }
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!user || user.password !== password) {
      setLoginError('Ungültige Anmeldedaten.');
      return;
    }
    const nextAuth = { id: user.id, name: user.name, role: user.role };
    setAuth(nextAuth);
    localStorage.setItem(AUTH_KEY, JSON.stringify(nextAuth));
    setLoginPassword('');
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem(AUTH_KEY);
    navigate('/');
  };

  const handleAddUser = () => {
    const name = newUserName.trim();
    const password = newUserPassword.trim();
    if (!name || !password) return;
    if (users.some(user => user.name.toLowerCase() === name.toLowerCase())) return;
    setUsers(prev => [
      ...prev,
      { id: Date.now().toString(), name, password, role: newUserRole, allowedApps: ['busflow'] }
    ]);
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole('DISPATCH');
  };

  const handleRemoveUser = (id: string) => {
    if (auth?.id === id) return;
    setUsers(prev => prev.filter(user => user.id !== id));
  };

  const handleUpdateUser = (id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(user => (user.id === id ? { ...user, ...updates } : user)));
  };

  const handleSaveProfile = () => {
    if (!currentUser) return;
    const updates: Partial<User> = {
      email: profileEmail.trim(),
      avatarUrl: profileAvatarUrl.trim()
    };
    if (profilePassword.trim()) {
      updates.password = profilePassword.trim();
    }
    handleUpdateUser(currentUser.id, updates);
    setProfilePassword('');
  };

  const apps = [
    {
      id: 'busflow',
      title: 'BusFlow Routenplanung',
      description: 'Routen, Halte, Fahrgastzahlen und Druckansicht verwalten.',
      icon: Bus,
      roles: ['ADMIN', 'DISPATCH', 'VIEWER'] as const,
      onClick: () => navigate('/busflow')
    }
  ];

  const allowedAppIds = auth
    ? users.find(user => user.id === auth.id)?.allowedApps
    : undefined;
  const visibleApps = auth
    ? apps.filter(app => app.roles.includes(auth.role) && (!allowedAppIds || allowedAppIds.includes(app.id)))
    : apps;

  const contentClass = !auth ? 'pointer-events-none blur-sm' : '';

  return (
    <div className="min-h-screen flex flex-col">
      {!usersLoaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg px-10 py-8 flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Leaf className="w-8 h-8 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Lade Daten ...</p>
          </div>
        </div>
      )}
      {!auth && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm no-print">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-8 py-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Anmeldung</h2>
            <p className="text-sm text-slate-500 mb-6">Bitte melden Sie sich an, um fortzufahren.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                  placeholder="z. B. Max Mustermann"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Passwort</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                  placeholder="••••••••"
                />
              </div>
              {loginError && <p className="text-sm text-red-600">{loginError}</p>}
              <button
                onClick={handleLogin}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Anmelden
              </button>
              <p className="text-xs text-slate-400">Standard-Admin: Admin / admin123</p>
            </div>
          </div>
        </div>
      )}
      <div className={contentClass}>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                apps={visibleApps}
                auth={currentUser ? { name: currentUser.name, role: currentUser.role, avatarUrl: currentUser.avatarUrl } : null}
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
                authUser={currentUser ? { name: currentUser.name, role: currentUser.role, avatarUrl: currentUser.avatarUrl } : null}
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
              auth?.role === 'ADMIN' ? (
                <Admin
                  users={users}
                  apps={apps.map(app => ({ id: app.id, title: app.title }))}
                  currentUserId={auth?.id}
                  newUserName={newUserName}
                  newUserPassword={newUserPassword}
                  newUserRole={newUserRole}
                  onNewUserName={setNewUserName}
                  onNewUserPassword={setNewUserPassword}
                  onNewUserRole={setNewUserRole}
                  onAddUser={handleAddUser}
                  onRemoveUser={handleRemoveUser}
                  onUpdateUser={handleUpdateUser}
                  header={{
                    title: 'Adminbereich',
                    user: currentUser ? { name: currentUser.name, role: currentUser.role, avatarUrl: currentUser.avatarUrl } : null,
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
              currentUser ? (
                <Profile
                  name={currentUser.name}
                  role={currentUser.role}
                  avatarUrl={currentUser.avatarUrl}
                  email={currentUser.email || ''}
                  profileEmail={profileEmail}
                  profileAvatarUrl={profileAvatarUrl}
                  profilePassword={profilePassword}
                  onEmailChange={setProfileEmail}
                  onAvatarChange={setProfileAvatarUrl}
                  onPasswordChange={setProfilePassword}
                  onSave={handleSaveProfile}
                  onGoHome={() => navigate('/')}
                  onLogout={handleLogout}
                  onProfile={() => navigate('/profile')}
                  onAdmin={() => navigate('/admin')}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
