import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { User } from '../types';

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

  // Load user profile from database
  const loadUserProfile = useCallback(async (supabaseUser: SupabaseUser): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error) {
        console.warn('Profile not found or error loading, using fallback data:', error.message);
        // Fallback to Supabase user metadata or email
        return {
          id: supabaseUser.id,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
          email: supabaseUser.email || '',
          avatar: supabaseUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User')}&background=random`,
        };
      }

      return {
        id: data.id,
        name: data.name || supabaseUser.email?.split('@')[0] || 'User',
        email: data.email || supabaseUser.email || '',
        avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'User')}&background=random`,
      };
    } catch (error) {
      console.error('Unexpected error loading user profile:', error);
      // Even on unexpected error, try to return a fallback instead of null to avoid login hangs
      return {
        id: supabaseUser.id,
        name: supabaseUser.email?.split('@')[0] || 'User',
        email: supabaseUser.email || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(supabaseUser.email?.split('@')[0] || 'User')}&background=random`,
      };
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
          const profile = await loadUserProfile(session.user);
          if (mounted) setUser(profile);
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
      
      console.log('Auth state change event:', event);
      setSession(session);
      
      try {
        if (session?.user) {
          // Profile loading is starting
          const profile = await loadUserProfile(session.user);
          if (mounted) setUser(profile);
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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } finally {
      setIsProcessing(false);
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
          emailRedirectTo: `${window.location.origin}/dashboard`,
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
          redirectTo: `${window.location.origin}/dashboard`,
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
          redirectTo: `${window.location.origin}/dashboard`,
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
