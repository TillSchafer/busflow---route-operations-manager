import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'ADMIN' | 'DISPATCH' | 'VIEWER';
type GlobalRole = 'ADMIN' | 'USER';
type MembershipRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  avatarUrl?: string;
  allowedApps?: string[];
  isPlatformAdmin?: boolean;
  isPlatformOwner?: boolean;
}

export interface AccountSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  trialState?: 'TRIAL_ACTIVE' | 'TRIAL_ENDED' | 'SUBSCRIBED';
  trialEndsAt?: string;
}

interface AuthContextType {
  user: User | null;
  activeAccountId: string | null;
  activeAccount: AccountSummary | null;
  canManageTenantUsers: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PLATFORM_OWNER_EMAIL =
  (import.meta.env.VITE_PLATFORM_OWNER_EMAIL as string | undefined)?.trim().toLowerCase() ||
  'till-schaefer@outlook.com';

const toRole = (value: MembershipRole | undefined): Role => {
  if (value === 'ADMIN' || value === 'DISPATCH' || value === 'VIEWER') {
    return value;
  }
  return 'VIEWER';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccount, setActiveAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const fetchActiveMembership = useCallback(async (userId: string, isPlatformAdmin: boolean): Promise<AccountSummary | null> => {
    try {
      const { data, error } = await supabase
        .from('account_memberships')
        .select(`
          account_id,
          role,
          status,
          created_at,
          platform_accounts!inner (id, name, slug, trial_state, trial_ends_at)
        `)
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        setActiveAccount(null);
        setActiveAccountId(null);
        return null;
      }

      const row = data[0] as {
        account_id: string;
        role: MembershipRole;
        platform_accounts:
          | { id: string; name: string; slug: string; trial_state?: string | null; trial_ends_at?: string | null }
          | { id: string; name: string; slug: string; trial_state?: string | null; trial_ends_at?: string | null }[];
      };

      const account = Array.isArray(row.platform_accounts) ? row.platform_accounts[0] : row.platform_accounts;
      const membershipRole = isPlatformAdmin ? 'ADMIN' : toRole(row.role);

      const summary: AccountSummary = {
        id: account?.id || row.account_id,
        name: account?.name || 'Account',
        slug: account?.slug || '',
        role: membershipRole,
        trialState: (account?.trial_state as AccountSummary['trialState']) || undefined,
        trialEndsAt: account?.trial_ends_at || undefined,
      };

      setActiveAccount(summary);
      setActiveAccountId(summary.id);
      return summary;
    } catch (error) {
      console.error('Unexpected error fetching memberships:', error);
      setActiveAccount(null);
      setActiveAccountId(null);
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, global_role')
        .eq('id', userId)
        .maybeSingle();

      if (error || !profile) {
        const fallbackName = email?.split('@')[0] || 'User';
        setUser({
          id: userId,
          name: fallbackName,
          role: 'VIEWER',
          email
        });
        setActiveAccount(null);
        setActiveAccountId(null);
        return;
      }

      const isPlatformAdmin = (profile.global_role as GlobalRole) === 'ADMIN';
      const isPlatformOwner =
        isPlatformAdmin &&
        !!profile.email &&
        profile.email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
      const membership = await fetchActiveMembership(profile.id, isPlatformAdmin);

      const effectiveRole: Role = isPlatformAdmin ? 'ADMIN' : membership?.role || 'VIEWER';

      setUser({
        id: profile.id,
        name: profile.full_name || email?.split('@')[0] || 'User',
        role: effectiveRole,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        isPlatformAdmin,
        isPlatformOwner
      });
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchActiveMembership]);

  useEffect(() => {
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
        setActiveAccount(null);
        setActiveAccountId(null);
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
        { event: '*', schema: 'public', table: 'account_memberships', filter: `user_id=eq.${sessionUserId}` },
        () => fetchProfile(sessionUserId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProfile, sessionUserId]);

  const login = async () => {
    console.warn('Login action is handled directly in App.tsx form flow.');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActiveAccount(null);
    setActiveAccountId(null);
  };

  const canManageTenantUsers = !!(user?.isPlatformAdmin || activeAccount?.role === 'ADMIN');

  return (
    <AuthContext.Provider value={{ user, activeAccountId, activeAccount, canManageTenantUsers, loading, login, logout, isAuthenticated: !!user }}>
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
