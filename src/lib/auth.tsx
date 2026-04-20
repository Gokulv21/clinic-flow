import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { logSecurityEvent } from './security';

export type AppRole = 'doctor' | 'staff' | 'superadmin' | 'owner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: { full_name: string; clinic_id?: string } | null;
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
  const [profile, setProfile] = useState<{ full_name: string; clinic_id?: string } | null>(() => {
    const saved = sessionStorage.getItem('user_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedId = useRef<string | null>(null);
  const isFetching = useRef(false);

  const fetchUserData = async (userId: string, force = false) => {
    if (isFetching.current && !force) return;

    if (userId === lastFetchedId.current && roles.length > 0 && !force) {
      setLoading(false);
      return;
    }

    isFetching.current = true;
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name, is_superadmin, clinic_id').eq('user_id', userId).maybeSingle(),
      ]);

      if (rolesRes.error) throw rolesRes.error;

      const rolesFromDB = (rolesRes.data || []).map(r => r.role as AppRole);
      const profileData = profileRes.data || null;
      const isSuper = !!profileData?.is_superadmin;
      const newRoles = isSuper ? [...rolesFromDB, 'superadmin' as AppRole] : rolesFromDB;

      setRoles(newRoles);
      setProfile(profileData);

      // Security: Update last activity
      if (userId) {
        supabase.from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('user_id', userId)
          .then();
      }

      sessionStorage.setItem('app_roles', JSON.stringify(newRoles));
      sessionStorage.setItem('user_profile', JSON.stringify(profileData));

      lastFetchedId.current = userId;
    } catch (err: any) {
      console.error('[Auth] Error fetching user data:', err);
      if (roles.length === 0) {
        const isNetworkError = err.message?.includes('fetch') || err.message?.includes('Network') || !navigator.onLine;
        setError(isNetworkError ? 'Network Connection Issue' : err.message || 'Failed to connect');
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
    if (!user) return;
    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => signOut(), 3600000); // 1 hour
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const timeoutId = setTimeout(() => mounted && setLoading(false), 8000);
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted && initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchUserData(initialSession.user.id);
        } else if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        if (mounted) setLoading(false);
      } finally {
        if (mounted) clearTimeout(timeoutId);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          if (event === 'SIGNED_IN') {
             logSecurityEvent('LOGIN_SUCCESS', { method: 'password' });
             fetchUserData(currentUser.id);
          } else if (event === 'TOKEN_REFRESHED') {
            fetchUserData(currentUser.id);
          }
        } else if (event === 'SIGNED_OUT') {
          logSecurityEvent('LOGOUT');
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
    
    // Check Rate Limit (DB call)
    try {
        const { data: allowed, error: limitError } = await supabase.rpc('check_rate_limit', {
            p_identifier: email,
            p_bucket: 'login',
            p_max_requests: 5,
            p_interval_seconds: 600
        });

        if (limitError) {
            console.error("Rate limit check failed:", limitError);
        } else if (allowed === false) {
             const limitErr = new Error('Too many login attempts. Please try again in 10 minutes.');
             logSecurityEvent('SUSPICIOUS_TRAFFIC', { reason: 'Brute Force Attempt Detected', email });
             return { error: limitErr };
        }
    } catch (e) {
        console.warn("Security check failed, bypassing to allow access...");
    }

    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) logSecurityEvent('LOGIN_FAILURE', { email });
    return { error: result.error as Error | null };
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
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