import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'ADMIN' | 'DISPATCH' | 'VIEWER';
type GlobalRole = 'ADMIN' | 'USER';
type AppPermissionRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  avatarUrl?: string;
  allowedApps?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>; // Modified to trigger OAuth/MagicLink
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist yet (race condition with trigger), fallback to basic info
        setUser({
          id: userId,
          name: email?.split('@')[0] || 'User',
          role: 'VIEWER', // Default safe role
          email: email
        });
      } else if (profile) {
        const { data: permissionRow, error: permissionError } = await supabase
          .from('app_permissions')
          .select('role')
          .eq('user_id', userId)
          .eq('app_id', 'busflow')
          .maybeSingle();

        if (permissionError) {
          console.error('Error fetching app permission:', permissionError);
        }

        const globalRole = profile.global_role as GlobalRole;
        const appRole = permissionRow?.role as AppPermissionRole | undefined;

        // Effective frontend role:
        // - Platform admins stay ADMIN (can open admin area)
        // - BusFlow ADMIN/DISPATCH both map to DISPATCH rights in current UI
        // - VIEWER stays read-only
        let role: Role = 'VIEWER';
        if (globalRole === 'ADMIN') role = 'ADMIN';
        else if (appRole === 'ADMIN' || appRole === 'DISPATCH') role = 'DISPATCH';

        setUser({
          id: profile.id,
          name: profile.full_name || email?.split('@')[0] || 'User',
          role: role,
          email: profile.email,
          avatarUrl: profile.avatar_url
        });
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionUserId(session.user.id);
        fetchProfile(session.user.id, session.user.email);
      } else {
        setSessionUserId(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSessionUserId(session.user.id);
        fetchProfile(session.user.id, session.user.email);
      } else {
        setSessionUserId(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  useEffect(() => {
    if (!sessionUserId) return;

    const channel = supabase
      .channel(`auth-role-sync-${sessionUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${sessionUserId}` },
        () => fetchProfile(sessionUserId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_permissions', filter: `user_id=eq.${sessionUserId}` },
        () => fetchProfile(sessionUserId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProfile, sessionUserId]);

  const login = async () => {
    // For simplicity, we'll use Google OAuth or Magic Link
    // Here we use Google as stored in Supabase project settings
    // Or we can just prompt for email in a real UI form.
    // Let's implement a generic "signInWithMsg" for now or redirect
    alert("Please implement specific login UI (Email/Password or OAuth) in the Login component.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
