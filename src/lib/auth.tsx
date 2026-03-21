import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
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
  const [roles, setRoles] = useState<AppRole[]>(() => {
    const saved = sessionStorage.getItem('app_roles');
    return saved ? JSON.parse(saved) : [];
  });
  const [profile, setProfile] = useState<{ full_name: string } | null>(() => {
    const saved = sessionStorage.getItem('user_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedId = useRef<string | null>(null);
  const isFetching = useRef(false);

  const fetchUserData = async (userId: string, force = false) => {
    if (isFetching.current && !force) return;
    
    // Prevent redundant fetches if we already have the data
    if (userId === lastFetchedId.current && roles.length > 0 && !force) {
      setLoading(false);
      return;
    }
    
    console.log('[Auth] Fetching user data for:', userId);
    isFetching.current = true;
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle(),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (profileRes.error) throw profileRes.error;

      const newRoles = (rolesRes.data || []).map(r => r.role as AppRole);
      setRoles(newRoles);
      setProfile(profileRes.data || null);
      
      // Cache for faster subsequent loads
      sessionStorage.setItem('app_roles', JSON.stringify(newRoles));
      sessionStorage.setItem('user_profile', JSON.stringify(profileRes.data));
      
      lastFetchedId.current = userId;
      setError(null); // Clear errors if we successfully fetched
    } catch (err: any) {
      console.error('[Auth] Error fetching user data (might be offline):', err);
      // If we have cached roles, don't set a global error that blocks the whole app
      if (roles.length === 0) {
        setError(err.message || 'Failed to connect to security service');
      }
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (user) {
      lastFetchedId.current = null;
      await fetchUserData(user.id, true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // Safety timeout: ensure loading screen clears within 5 seconds regardless of network
      const timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn('[Auth] Hydration timeout reached. Forcing loading false.');
          setLoading(false);
        }
      }, 5000);

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          // OFFLINE-FIRST: Unblock the UI immediately if we have cached roles
          if (roles.length > 0) {
            setLoading(false);
          }
          
          await fetchUserData(initialSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
        // Even if session lookup fails (e.g. offline), let the app mount
        // ProtectedRoute will handle !user by redirecting to login later
        setLoading(false);
      } finally {
        if (mounted) clearTimeout(timeoutId);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;
        console.log('[Auth] State change:', event);
        
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          fetchUserData(currentUser.id);
        } else {
          setRoles([]);
          setProfile(null);
          setError(null);
          lastFetchedId.current = null;
          setLoading(false);
        }
      });

      return subscription;
    };

    const subPromise = initAuth();

    return () => {
      mounted = false;
      subPromise.then(sub => sub?.unsubscribe());
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };


  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] Sign out error:', e);
    } finally {
      setUser(null);
      setSession(null);
      setRoles([]);
      setProfile(null);
      setError(null);
      lastFetchedId.current = null;
      sessionStorage.clear();
      localStorage.clear();
      setLoading(false);
    }
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