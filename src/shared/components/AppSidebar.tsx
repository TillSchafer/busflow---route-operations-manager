import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutList, Map, User, LogOut, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const STORAGE_KEY = 'dizpo_sidebar_collapsed';

export const AppSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors no-print ${
      isActive
        ? 'bg-slate-700 text-white'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <aside
      className={`bg-slate-900 flex flex-col sticky top-0 h-screen shrink-0 transition-all duration-200 no-print ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo + Toggle */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-700">
        {!collapsed && (
          <span className="text-white font-bold text-lg tracking-tight truncate">Dizpo</span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800 ${
            collapsed ? 'mx-auto' : ''
          }`}
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-hidden">
        <NavLink to="/dizpo" className={navItemClass} title="Ablaufplanung">
          <LayoutList className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">Ablaufplanung</span>}
        </NavLink>
        <NavLink to="/karte" className={navItemClass} title="Karte">
          <Map className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">Karte</span>}
        </NavLink>
      </nav>

      {/* Bottom: Dashboard + Profile + Logout */}
      <div className="flex flex-col gap-1 p-2 border-t border-slate-700">
        <NavLink to="/" className={navItemClass} title="Dashboard">
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">Dashboard</span>}
        </NavLink>
        <NavLink to="/profile" className={navItemClass} title={user?.name || 'Profil'}>
          <User className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">{user?.name || 'Profil'}</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Abmelden"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </div>
    </aside>
  );
};
