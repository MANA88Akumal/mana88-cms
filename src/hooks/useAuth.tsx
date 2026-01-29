import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
  isApproved: boolean;
  hasCmsAccess: boolean;
  signInWithGoogle: () => Promise<any>;
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
    console.log('useAuth: Starting init...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('useAuth: getSession result', session?.user?.email || 'no session', error);
      if (session?.user) {
        setUser(session.user);
        // Fetch profile
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            console.log('useAuth: profile fetched', data?.email);
            setProfile(data);
            setLoading(false);
          });
      } else {
        console.log('useAuth: No session, setting loading=false');
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('useAuth: auth event', event, session?.user?.email);
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            setProfile(data);
            setLoading(false);
          });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    }
  };

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
      isStaff: profile?.role === 'staff' || profile?.role === 'admin',
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
