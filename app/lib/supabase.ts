import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  // This project uses Supabase from Client Components only.
  // Avoid initializing at import-time so builds don't fail when env is missing.
  if (typeof window === 'undefined') {
    throw new Error('Supabase client must be used in the browser (client components).');
  }

  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  _client = createClient(url, key);
  return _client;
}
