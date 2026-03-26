import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { clearGuestLocalData } from '../utils/guestStorage';
import { User } from '../types';

// Build the hash-based redirect URL so Supabase lands inside the HashRouter SPA.
// e.g. https://myapp.com/#/dashboard instead of https://myapp.com/dashboard
const authRedirectTo = (path: string) => `${window.location.origin}/#${path}`;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isProcessing: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const isLoadingProfileRef = useRef(false);
  // Monotonically-increasing counter used to detect and discard stale profile
  // responses that arrive after a timeout fallback has already been applied.
  const profileRequestIdRef = useRef(0);

  // Load user profile from database with timeout.
  // Uses a request-ID guard so that if the DB query resolves after the timeout
  // fallback has been committed, the stale result is silently ignored.
  const loadUserProfile = useCallback(async (supabaseUser: SupabaseUser): Promise<User | null> => {
    const createFallbackProfile = (): User => ({
      id: supabaseUser.id,
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
      email: supabaseUser.email || '',
      avatar:
        supabaseUser.user_metadata?.avatar_url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
        )}&background=random`,
    });

    const requestId = ++profileRequestIdRef.current;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile query timeout')), 5000);
      });

      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      // Discard if a newer request has already settled (e.g. timeout fired first)
      if (requestId !== profileRequestIdRef.current) return null;

      if (error) {
        console.warn('Profile not found, using fallback:', error.message);
        return createFallbackProfile();
      }

      return {
        id: data.id,
        name: data.name || supabaseUser.email?.split('@')[0] || 'User',
        email: data.email || supabaseUser.email || '',
        avatar:
          data.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'User')}&background=random`,
      };
    } catch {
      // Timeout or network error — discard if a newer request settled first
      if (requestId !== profileRequestIdRef.current) return null;
      console.warn('Profile query timeout, using fallback');
      return createFallbackProfile();
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        setLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        if (!mounted) return;

        setSession(session);
        if (session?.user) {
          clearGuestLocalData();
          const profile = await loadUserProfile(session.user);
          // profile is null only when a newer request superseded this one; skip
          if (mounted && profile !== null) setUser(profile);
        } else {
          if (mounted) setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // Skip if we're already in the middle of loading a profile from signInWithPassword
      if (isLoadingProfileRef.current && event === 'SIGNED_IN') {
        return;
      }
      
      setSession(session);
      setLoading(true);
      
      try {
        if (session?.user) {
          clearGuestLocalData();
          const profile = await loadUserProfile(session.user);
          if (mounted && profile !== null) setUser(profile);
        } else {
          if (mounted) setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signInWithPassword = async (email: string, password: string) => {
    setIsProcessing(true);
    isLoadingProfileRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        return { error };
      }
      
      if (data.user) {
        clearGuestLocalData();
        const profile = await loadUserProfile(data.user);
        if (profile !== null) setUser(profile);
        setSession(data.session);
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error };
    } finally {
      setIsProcessing(false);
      isLoadingProfileRef.current = false;
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
          },
          emailRedirectTo: authRedirectTo('/dashboard'),
        },
      });
      return { error };
    } finally {
      setIsProcessing(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authRedirectTo('/dashboard'),
        },
      });
      return { error };
    } finally {
      setIsProcessing(false);
    }
  };

  const signInWithApple = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: authRedirectTo('/dashboard'),
        },
      });
      return { error };
    } finally {
      setIsProcessing(false);
    }
  };

  const signInAsGuest = () => {
    // Create a guest user without Supabase authentication
    const guestUser: User = {
      id: 'guest',
      name: 'Guest User',
      email: 'guest@squareone.app',
      avatar: 'https://ui-avatars.com/api/?name=Guest&background=random',
    };
    setUser(guestUser);
    setSession(null); // No session for guest
  };

  const signOut = async () => {
    setIsProcessing(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isProcessing,
    signInWithPassword,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signInAsGuest,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
