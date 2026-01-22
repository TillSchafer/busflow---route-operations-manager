import React from 'react';
import AppHeader from '../components/AppHeader';

interface AppCard {
  id: string;
  title: string;
}

interface User {
  id: string;
  name: string;
  password: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  allowedApps?: string[];
}

interface Props {
  users: User[];
  apps: AppCard[];
  currentUserId?: string;
  newUserName: string;
  newUserPassword: string;
  newUserRole: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  onNewUserName: (value: string) => void;
  onNewUserPassword: (value: string) => void;
  onNewUserRole: (value: 'ADMIN' | 'DISPATCH' | 'VIEWER') => void;
  onAddUser: () => void;
  onRemoveUser: (id: string) => void;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  header: {
    title: string;
    user: { name: string; role: 'ADMIN' | 'DISPATCH' | 'VIEWER'; avatarUrl?: string } | null;
    onHome: () => void;
    onProfile: () => void;
    onAdmin: () => void;
    onLogout: () => void;
  };
}

const Admin: React.FC<Props> = ({
  users,
  apps,
  currentUserId,
  newUserName,
  newUserPassword,
  newUserRole,
  onNewUserName,
  onNewUserPassword,
  onNewUserRole,
  onAddUser,
  onRemoveUser,
  onUpdateUser,
  header
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title={header.title}
        user={header.user}
        onHome={header.onHome}
        onProfile={header.onProfile}
        onAdmin={header.onAdmin}
        onLogout={header.onLogout}
      />
      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">Benutzerverwaltung</h2>
        <p className="text-sm text-slate-500 mt-1">Benutzer hinzufügen, bearbeiten oder entfernen.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={newUserName}
              onChange={e => onNewUserName(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              placeholder="z. B. Anna Schmidt"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Passwort</label>
            <input
              type="text"
              value={newUserPassword}
              onChange={e => onNewUserPassword(e.target.value)}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              placeholder="********"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Rolle</label>
            <select
              value={newUserRole}
              onChange={e => onNewUserRole(e.target.value as 'ADMIN' | 'DISPATCH' | 'VIEWER')}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
            >
              <option value="ADMIN">Admin</option>
              <option value="DISPATCH">Disposition</option>
              <option value="VIEWER">Nur Lesen</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <button
              onClick={onAddUser}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Benutzer hinzufügen
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Bestehende Benutzer</h3>
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center border border-slate-200 rounded-lg p-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  value={user.name}
                  onChange={e => onUpdateUser(user.id, { name: e.target.value })}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Passwort</label>
                <input
                  type="text"
                  value={user.password}
                  onChange={e => onUpdateUser(user.id, { password: e.target.value })}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rolle</label>
                <select
                  value={user.role}
                  onChange={e => onUpdateUser(user.id, { role: e.target.value as 'ADMIN' | 'DISPATCH' | 'VIEWER' })}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="DISPATCH">Disposition</option>
                  <option value="VIEWER">Nur Lesen</option>
                </select>
              </div>
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-slate-500 mb-2">Apps</label>
                <div className="flex flex-wrap gap-2">
                  {apps.map(app => {
                    const allowed = user.allowedApps ?? apps.map(item => item.id);
                    const isChecked = allowed.includes(app.id);
                    return (
                      <label key={app.id} className="flex items-center space-x-2 text-xs bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const nextAllowed = e.target.checked
                              ? Array.from(new Set([...allowed, app.id]))
                              : allowed.filter(id => id !== app.id);
                            onUpdateUser(user.id, { allowedApps: nextAllowed });
                          }}
                        />
                        <span>{app.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end md:col-span-5">
                <button
                  onClick={() => onRemoveUser(user.id)}
                  disabled={currentUserId === user.id}
                  className={`px-3 py-2 rounded-md text-sm font-semibold ${
                    currentUserId === user.id
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  Entfernen
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </main>
    </div>
  );
};

export default Admin;
