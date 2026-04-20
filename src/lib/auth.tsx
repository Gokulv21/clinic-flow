import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'doctor' | 'staff' | 'superadmin';

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

    console.log(`[Auth] Fetching user data for: ${userId} (Force: ${force})`);
    isFetching.current = true;
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('full_name, is_superadmin, clinic_id').eq('user_id', userId).maybeSingle(),
      ]);

      if (rolesRes.error) {
        console.error('[Auth] Roles Fetch Error:', rolesRes.error);
        throw rolesRes.error;
      }
      const rolesFromDB = (rolesRes.data || []).map(r => r.role as AppRole);
      const profileData = profileRes.data || null;
      const isSuper = !!profileData?.is_superadmin;
      const newRoles = isSuper ? [...rolesFromDB, 'superadmin' as AppRole] : rolesFromDB;

      console.log('[Auth] User profiles data:', profileRes.data);
      console.log('[Auth] Final Roles:', newRoles);

      setRoles(newRoles);
      setProfile(profileRes.data || null);

      // Cache for faster subsequent loads
      sessionStorage.setItem('app_roles', JSON.stringify(newRoles));
      sessionStorage.setItem('user_profile', JSON.stringify(profileRes.data));

      lastFetchedId.current = userId;
      setError(null);
    } catch (err: any) {
      console.error('[Auth] Error fetching user data:', err);
      // If we have cached roles, don't set a global error that blocks the whole app
      if (roles.length === 0) {
        const isNetworkError = err.message?.includes('fetch') || err.message?.includes('Network') || !navigator.onLine;
        setError(isNetworkError ? 'Network Connection Issue (Database Blocked?)' : err.message || 'Failed to connect to security service');
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

  // Inactivity Timeout (1 hour)
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('[Auth] Session timed out due to inactivity.');
        signOut();
      }, 3600000); // 1 hour
    };

    // Events to watch
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => document.addEventListener(e, resetTimer));

    // Initial start
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      console.log('[Auth] Initializing Auth module...');

      const timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn('[Auth] Hydration timeout! Forcing loading false for usability.');
          setLoading(false);
        }
      }, 8000); // 8 second safety net for slow machine/network

      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[Auth] Session retrieval error:', sessionError);
        }

        if (!mounted) return;

        if (initialSession) {
          console.log('[Auth] Found existing session for:', initialSession.user.id);
          setSession(initialSession);
          setUser(initialSession.user);

          // OFFLINE-FIRST: Unblock the UI immediately if we have cached roles
          if (roles.length > 0) {
            console.log('[Auth] Immediate UI unblock with cached roles');
            setLoading(false);
          }

          await fetchUserData(initialSession.user.id);
        } else {
          console.log('[Auth] No session found.');
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Initialization crash:', err);
        setLoading(false);
      } finally {
        if (mounted) clearTimeout(timeoutId);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;
        console.log('[Auth] Supabase Event:', event);

        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            fetchUserData(currentUser.id);
          }
        } else {
          // If explicitly signed out, clear everything
          if (event === 'SIGNED_OUT') {
            setRoles([]);
            setProfile(null);
            setError(null);
            lastFetchedId.current = null;
          }
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