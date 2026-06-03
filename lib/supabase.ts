import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export function getServiceSupabase() {
  if (!supabaseServiceKey) {
    console.error("⚠️ SUPABASE_SERVICE_ROLE_KEY is not set in environment variables");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}