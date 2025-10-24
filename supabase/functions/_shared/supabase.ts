import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

export type SupabaseClient = ReturnType<typeof createClient<'public'>>

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url) throw new Error('Missing SUPABASE_URL env')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env')

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'repai-edge-functions',
      },
    },
  })
}

export function createUserClient(accessToken?: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!url) throw new Error('Missing SUPABASE_URL env')
  if (!anonKey) throw new Error('Missing SUPABASE_ANON_KEY env')

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
  })
}
