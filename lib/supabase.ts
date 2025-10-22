import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage'
import type { SupabaseClientOptions } from '@supabase/supabase-js'
import { createClient, processLock } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const isReactNative =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
const isServer = typeof window === 'undefined'

let asyncStorage: AsyncStorageStatic | undefined

if (isReactNative) {
  asyncStorage = require('@react-native-async-storage/async-storage').default
}

const supabaseOptions: SupabaseClientOptions<'public'> = {
  auth: {
    storage: asyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
    lock: processLock,
  },
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  supabaseOptions,
)
