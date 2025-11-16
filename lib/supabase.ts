import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage'
import type { SupabaseClientOptions } from '@supabase/supabase-js'
import { createClient, processLock } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'
import Constants from 'expo-constants'

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

const extra = (Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  {}) as {
  supabaseUrl?: string
  supabaseAnonKey?: string
  appEnv?: string
}

const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment is not configured')
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions)
