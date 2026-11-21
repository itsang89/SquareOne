import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key: string) => {
        const value = localStorage.getItem(key);
        if (value) return value;
        return sessionStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        const rememberMe = localStorage.getItem('squareone_remember_me') !== 'false';
        if (rememberMe) {
          localStorage.setItem(key, value);
        } else {
          sessionStorage.setItem(key, value);
        }
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});


/** supabase-js default key for the saved session. */
const SESSION_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

/** The saved session as-is, without refreshing it. Keeps you signed in offline after the access token expires. */
export function storedSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Forget the saved session on this device (for sign-out when the server can't be reached). */
export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
