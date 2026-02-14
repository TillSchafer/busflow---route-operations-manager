import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'ADMIN' | 'DISPATCH' | 'VIEWER';

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

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
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
      } else if (data) {
        // Fetch permissions for apps could happen here or separately
        // For now, mapping global_role to app role simplified
        let role: Role = 'VIEWER';
        if (data.global_role === 'ADMIN') role = 'ADMIN';
        else role = 'DISPATCH'; // Default user role for now, or fetch from permissions table

        setUser({
          id: data.id,
          name: data.full_name || email?.split('@')[0] || 'User',
          role: role,
          email: data.email,
          avatarUrl: data.avatar_url
        });
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

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
