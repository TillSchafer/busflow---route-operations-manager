import React, { useState } from 'react';

type Role = 'ADMIN' | 'DISPATCH' | 'VIEWER';

interface User {
  name: string;
  role: Role;
  avatarUrl?: string;
  isPlatformOwner?: boolean;
}

interface Props {
  user: User;
  onProfile: () => void;
  onAdmin?: () => void;
  onOwnerArea?: () => void;
  onLogout: () => void;
}

const ProfileMenu: React.FC<Props> = ({ user, onProfile, onAdmin, onOwnerArea, onLogout }) => {
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === 'ADMIN';
  const initials = user.name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const buttonClass = 'flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors whitespace-nowrap';
  const menuClass = 'absolute right-0 mt-2 w-44 rounded-lg border border-slate-700 bg-slate-900 text-white shadow-lg';
  const itemClass = 'w-full text-left px-3 py-2 text-sm hover:bg-slate-800';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={buttonClass}
      >
        <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
          {user.avatarUrl && /^https:\/\//.test(user.avatarUrl) ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initials
          )}
        </div>
        <div className="text-xs leading-tight">
          <p className="text-white font-semibold">{user.name}</p>
          <p className="text-slate-300">
            {user.role === 'ADMIN' ? 'Admin' : user.role === 'DISPATCH' ? 'Disposition' : 'Fahrer'}
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
          {user.isPlatformOwner && onOwnerArea && (
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onOwnerArea();
                setOpen(false);
              }}
              className={itemClass}
            >
              Owner Bereich
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
