import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, getSharedAuthCookie, clearSharedAuthCookie } from '../lib/supabase';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  system_access: Record<string, boolean> | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  userRole: string;
  isAdmin: boolean;
  isStaff: boolean;
  staff: boolean;
  isApproved: boolean;
  hasCmsAccess: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      console.log('useAuth: Starting init...');
      
      // 1. Check for tokens in URL hash (from login portal redirect)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        
        if (access_token && refresh_token) {
          console.log('useAuth: Found tokens in URL');
          const { data } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });
          
          if (data?.session) {
            setUser(data.session.user);
            window.history.replaceState(null, '', window.location.pathname);
            
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.session.user.id)
              .single();
            setProfile(profileData);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Check existing Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('useAuth: Found existing session', session.user.email);
        setUser(session.user);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
        setLoading(false);
        return;
      }

      // 3. Check shared cookie
      const cookieSession = getSharedAuthCookie();
      if (cookieSession?.access_token && cookieSession?.refresh_token) {
        console.log('useAuth: Found shared cookie');
        const { data } = await supabase.auth.setSession({
          access_token: cookieSession.access_token,
          refresh_token: cookieSession.refresh_token
        });
        
        if (data?.session) {
          setUser(data.session.user);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single();
          setProfile(profileData);
          setLoading(false);
          return;
        }
      }

      // 4. No session - redirect to login portal
      console.log('useAuth: No session, redirecting to login portal');
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `https://login.manaakumal.com?returnTo=${returnUrl}`;
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('useAuth: auth event', event, session?.user?.email);
      if (session) {
        setUser(session.user);
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setProfile(data));
      } else if (event === 'SIGNED_OUT') {
        clearSharedAuthCookie();
        window.location.href = 'https://login.manaakumal.com';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Redirect to login portal instead
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://login.manaakumal.com?returnTo=${returnUrl}`;
  };

  const signOut = async () => {
    clearSharedAuthCookie();
    await supabase.auth.signOut();
    window.location.href = 'https://login.manaakumal.com';
  };

  const refreshProfile = async () => {
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    }
  };

  const isStaffRole = profile?.role === 'staff' || profile?.role === 'admin';
  
  const hasCmsAccess = profile ? (
    profile.role === 'admin' || profile.role === 'staff' || 
    profile.role === 'finance' || profile.role === 'legal' ||
    profile.system_access?.cms === true
  ) : false;

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      userRole: profile?.role || 'investor',
      isAdmin: profile?.role === 'admin',
      isStaff: isStaffRole,
      staff: isStaffRole,
      isApproved: profile?.approved || false,
      hasCmsAccess,
      signInWithGoogle,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};
