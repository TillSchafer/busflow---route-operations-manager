import React, { useState } from 'react';

type Role = 'ADMIN' | 'DISPATCH' | 'VIEWER';

interface User {
  name: string;
  role: Role;
  avatarUrl?: string;
}

interface Props {
  user: User;
  variant?: 'home' | 'header';
  onProfile: () => void;
  onAdmin?: () => void;
  onLogout: () => void;
}

const ProfileMenu: React.FC<Props> = ({ user, variant = 'header', onProfile, onAdmin, onLogout }) => {
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === 'ADMIN';
  const initials = user.name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isHome = variant === 'home';
  const buttonClass = isHome
    ? 'flex items-center space-x-3 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm'
    : 'flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors whitespace-nowrap';
  const menuClass = isHome
    ? 'absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white text-slate-900 shadow-lg'
    : 'absolute right-0 mt-2 w-44 rounded-lg border border-slate-700 bg-slate-900 text-white shadow-lg';
  const itemClass = isHome
    ? 'w-full text-left px-3 py-2 text-sm hover:bg-slate-50'
    : 'w-full text-left px-3 py-2 text-sm hover:bg-slate-800';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={buttonClass}
      >
        <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className={`text-xs leading-tight ${isHome ? 'text-left' : ''}`}>
          <p className={`${isHome ? 'text-slate-900' : 'text-white'} font-semibold`}>{user.name}</p>
          <p className={`${isHome ? 'text-slate-500' : 'text-slate-300'}`}>
            {user.role === 'ADMIN' ? 'Admin' : user.role === 'DISPATCH' ? 'Disposition' : 'Nur Lesen'}
          </p>
        </div>
      </button>
      {open && (
        <div className={menuClass}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              onProfile();
              setOpen(false);
            }}
            className={itemClass}
          >
            Einstellungen
          </button>
          {isAdmin && onAdmin && (
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onAdmin();
                setOpen(false);
              }}
              className={itemClass}
            >
              Adminbereich
            </button>
          )}
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
            className={itemClass}
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
