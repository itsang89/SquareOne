import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { clearGuestLocalData, readGuestSnapshot } from '../utils/guestStorage';
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
  refreshUser: () => Promise<void>;
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

  const migrateGuestData = async (uid: string): Promise<void> => {
    const snapshot = readGuestSnapshot();
    if (!snapshot || (snapshot.friends.length === 0 && snapshot.transactions.length === 0)) {
      clearGuestLocalData();
      return;
    }
    try {
      const friendRows = snapshot.friends.map(f => ({
        id: f.id,
        user_id: uid,
        name: f.name,
        avatar: f.avatar,
      }));
      const transactionRows = snapshot.transactions.map(tx => ({
        id: tx.id,
        user_id: uid,
        title: tx.title,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        payer_id: tx.payerId === 'me' ? uid : tx.payerId,
        friend_id: tx.friendId === 'me' ? tx.payerId : tx.friendId,
        note: tx.note ?? null,
        is_settlement: tx.isSettlement ?? false,
      }));
      await Promise.all([
        supabase.from('friends').upsert(friendRows, { ignoreDuplicates: true }),
        supabase.from('transactions').upsert(transactionRows, { ignoreDuplicates: true }),
      ]);
      clearGuestLocalData();
    } catch (err) {
      console.warn('Guest data migration failed, data preserved for retry:', err);
    }
  };

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

    const queryPromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Profile query timeout')), 5000);
    });

    try {
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      clearTimeout(timeoutId!);

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
      clearTimeout(timeoutId!);
      if (requestId !== profileRequestIdRef.current) return null;
      // Timeout or thrown network error — ignore late query resolution from this attempt.
      void Promise.resolve(queryPromise).catch(() => {});
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
          await migrateGuestData(session.user.id);
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

      // Token refresh happens on tab focus and on a background timer — it doesn't
      // change the user identity, so just update the session silently without
      // triggering a loading state or re-fetching the profile.
      if (event === 'TOKEN_REFRESHED') {
        if (mounted) setSession(session);
        return;
      }

      setSession(session);
      setLoading(true);

      try {
        if (session?.user) {
          await migrateGuestData(session.user.id);
          const profile = await loadUserProfile(session.user);
          if (mounted && profile !== null) {
            // Keep the same object reference when the user identity hasn't changed
            // so downstream contexts don't re-fetch data unnecessarily.
            setUser(prev => prev?.id === profile.id ? prev : profile);
          }
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
        await migrateGuestData(data.user.id);
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

  const refreshUser = async () => {
    if (!session?.user) return;
    const profile = await loadUserProfile(session.user);
    if (profile !== null) setUser(profile);
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
    refreshUser,
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
