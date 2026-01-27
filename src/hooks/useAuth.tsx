
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Global claim detection - runs when user logs in
        if (event === 'SIGNED_IN' && session?.user) {
          const urlParams = new URLSearchParams(window.location.search);
          const claimId = urlParams.get('claim_landing_id') ||
            window.sessionStorage.getItem('pending_claim_landing_id');

          if (claimId) {
            console.log('[AUTH CLAIM] Detected pending claim:', claimId);
            window.sessionStorage.removeItem('pending_claim_landing_id');

            // Remove from URL
            urlParams.delete('claim_landing_id');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);

            // Call claim Edge Function
            try {
              const { error } = await supabase.functions.invoke('claim-landing', {
                body: { landing_id: claimId }
              });

              if (error) {
                console.error('[AUTH CLAIM] Failed:', error);
              } else {
                console.log('[AUTH CLAIM] Success!');
              }
            } catch (e) {
              console.error('[AUTH CLAIM] Exception:', e);
            }
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    let redirectUrl = `${window.location.origin}/`;
    const pendingClaimId = window.sessionStorage.getItem('pending_claim_landing_id');
    if (pendingClaimId) {
      redirectUrl += `?claim_landing_id=${pendingClaimId}`;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      const isSessionMissing =
        error.name === 'AuthSessionMissingError' ||
        error.message?.toLowerCase().includes('auth session missing');

      if (!isSessionMissing) {
        console.error('Error signing out:', error);
        throw error;
      }
    }

    setSession(null);
    setUser(null);
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
