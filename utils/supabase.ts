import { createClient } from '@supabase/supabase-js';

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

