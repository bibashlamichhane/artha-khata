import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dcybhqijhdrxdomqdlho.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_kIMbWeUUrWnR8eaGe0qeig_ywwY_Ihz';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('KHATA Warning: Supabase environment variables not fully configured. Running in offline/local mode.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Standard Supabase auth session token storage
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
