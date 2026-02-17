import React from 'react';
import ProfileMenu from './ProfileMenu';

interface User {
  name: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  avatarUrl?: string;
}

interface Props {
  title: string;
  user: User | null;
  onHome: () => void;
  onProfile: () => void;
  onAdmin: () => void;
  onLogout: () => void;
  actions?: React.ReactNode;
  searchBar?: React.ReactNode;
}

const AppHeader: React.FC<Props> = ({ title, user, onHome, onProfile, onAdmin, onLogout, actions, searchBar }) => {
  return (
    <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 no-print flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-3 w-1/4">
        <button
          onClick={onHome}
          className="px-3 py-1.5 rounded-md transition-colors hover:bg-slate-800"
        >
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        </button>
      </div>

      <div className="flex-1 flex justify-center px-4">
        {searchBar}
      </div>

      <div className="flex items-center justify-end space-x-3 w-1/4">
        {actions}
        {user && (
          <ProfileMenu
            user={user}
            variant="header"
            onProfile={onProfile}
            onAdmin={onAdmin}
            onLogout={onLogout}
          />
        )}
      </div>
    </nav>
  );
};

export default AppHeader;
