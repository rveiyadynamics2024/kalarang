import { createClient } from '@supabase/supabase-js';

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing ${key}. Set it in your host's environment variables or in .env for local dev.`
    );
  }
  return value;
}

const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = requireEnv('VITE_SUPABASE_ANON_KEY');

/**
 * Single shared Supabase client. Uses the public "anon" key — safe to expose
 * in the browser bundle. All access control is enforced server-side by
 * Postgres Row Level Security policies (see supabase/schema.sql).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Name of the public Storage bucket used for product/collection/banner/video media. */
export const MEDIA_BUCKET = 'media';
