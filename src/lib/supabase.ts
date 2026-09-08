import { createClient } from '@supabase/supabase-js';

interface ImportMetaEnvShape {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  [key: string]: string | undefined;
}

const metaEnv = (import.meta as { env?: ImportMetaEnvShape }).env ?? {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const isSupabaseConfigured = Boolean(
  metaEnv.VITE_SUPABASE_URL &&
  metaEnv.VITE_SUPABASE_ANON_KEY &&
  metaEnv.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co',
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
  },
});
