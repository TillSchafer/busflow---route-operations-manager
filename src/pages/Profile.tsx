import React from 'react';
import AppHeader from '../shared/components/AppHeader';

interface Props {
  name: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  avatarUrl?: string;
  isPlatformOwner?: boolean;
  email: string;
  profileAvatarUrl: string;
  profileEmail: string;
  profilePassword: string;
  onEmailChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSave: () => void;
  onGoHome: () => void;
  onLogout: () => void;
  onProfile: () => void;
  onAdmin: () => void;
  onOwner?: () => void;
}

const Profile: React.FC<Props> = ({
  name,
  role,
  avatarUrl,
  isPlatformOwner,
  email,
  profileAvatarUrl,
  profileEmail,
  profilePassword,
  onEmailChange,
  onAvatarChange,
  onPasswordChange,
  onSave,
  onGoHome,
  onLogout,
  onProfile,
  onAdmin,
  onOwner
}) => {
  const initials = name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Mein Profil"
        user={{ name, role, avatarUrl, isPlatformOwner }}
        onHome={onGoHome}
        onProfile={onProfile}
        onAdmin={onAdmin}
        onOwner={onOwner}
        onLogout={onLogout}
      />
      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full">
        <div className="max-w-2xl">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Mein Profil</h2>
            <p className="text-sm text-slate-500 mt-1">E-Mail, Passwort und Profilbild verwalten.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="md:col-span-2 flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-lg font-bold overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Angemeldet als</p>
                  <p className="text-base font-bold text-slate-900">{name}</p>
                  <p className="text-xs text-slate-500">{role === 'ADMIN' ? 'Admin' : role === 'DISPATCH' ? 'Disposition' : 'Nur Lesen'}</p>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={profileEmail || email}
                  onChange={e => onEmailChange(e.target.value)}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                  placeholder="name@firma.de"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Profilbild URL</label>
                <input
                  type="url"
                  value={profileAvatarUrl}
                  onChange={e => onAvatarChange(e.target.value)}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                  placeholder="https://..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Neues Passwort</label>
                <input
                  type="password"
                  value={profilePassword}
                  onChange={e => onPasswordChange(e.target.value)}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                  placeholder="••••••••"
                />
                <p className="text-xs text-slate-400 mt-1">Leer lassen, wenn unverändert.</p>
              </div>
              <div className="md:col-span-2">
                <button
                  onClick={onSave}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Änderungen speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
