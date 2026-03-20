import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'doctor' | 'staff';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: { full_name: string } | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedId, setLastFetchedId] = useState<string | null>(null);

  const fetchUserData = async (userId: string) => {
    if (userId === lastFetchedId && roles.length > 0) return;
    
    console.log('Fetching user data for:', userId);
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle(),
      ]);

      if (rolesRes.error) throw new Error(rolesRes.error.message);
      if (profileRes.error) throw new Error(profileRes.error.message);

      setRoles((rolesRes.data || []).map(r => r.role as AppRole));
      setProfile(profileRes.data || null);
      setLastFetchedId(userId);
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message || 'Failed to connect to security service');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (user) {
      setLastFetchedId(null);
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchUserData(currentUser.id);
      } else {
        setRoles([]);
        setProfile(null);
        setError(null);
        setLastFetchedId(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserData(currentUser.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };


  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setRoles([]);
    setProfile(null);
    setError(null);
    setLastFetchedId(null);
    setLoading(false);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, roles, profile, loading, error, signIn, signOut, hasRole, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}