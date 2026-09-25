import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://wzqduhinycguhyqsjyyd.supabase.co';

const SUPABASE_PUBLISHABLE_KEY: string =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'sb_publishable__JtAxcXkHZJu4s4WX207qQ_JLtkmoAd';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
