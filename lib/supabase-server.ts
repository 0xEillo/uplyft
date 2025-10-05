import { createClient } from '@supabase/supabase-js'

export function createServerSupabaseClient(accessToken?: string) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  })
}
