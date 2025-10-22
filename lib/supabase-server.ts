import { createClient } from '@supabase/supabase-js'

function getUrl() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL')
  return url
}

function getAnonKey() {
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY
  if (!key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_KEY')
  return key
}

export function createServerSupabaseClient(accessToken?: string) {
  return createClient(getUrl(), getAnonKey(), {
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

export function createServiceSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env for service client')
  }

  return createClient(getUrl(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
