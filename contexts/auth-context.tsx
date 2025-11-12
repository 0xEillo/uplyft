import { supabase } from '@/lib/supabase'
import { Session, User } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { usePostHog } from 'posthog-react-native'
import { Platform } from 'react-native'
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

WebBrowser.maybeCompleteAuthSession()

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signUp: (email: string, password: string) => Promise<{ userId: string }>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: (signInOnly?: boolean) => Promise<void>
  signInWithApple: (signInOnly?: boolean) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const posthog = usePostHog()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error
    if (!data.user) throw new Error('No user returned from signup')

    posthog?.capture('Auth Sign Up', {
      method: 'password',
      userId: data.user.id,
      email: email.toLowerCase(),
    })

    return { userId: data.user.id }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    posthog?.capture('Auth Login', {
      method: 'password',
      email: email.toLowerCase(),
    })
  }

  const signInWithGoogle = async (signInOnly = false) => {
    const redirectUrl = makeRedirectUri({
      scheme: 'repai',
      path: 'auth/callback',
    })

    console.log('[auth] 🔗 redirectUrl:', redirectUrl)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (error) {
      console.error('[auth] ❌ OAuth error:', error)
      throw error
    }

    if (!data.url) {
      throw new Error('No OAuth URL generated')
    }

    console.log('[auth] 🌐 OAuth URL:', data.url)
    console.log('[auth] 📱 Opening browser with redirect:', redirectUrl)

    // Open OAuth in browser - works with standalone builds only
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

    console.log('[auth] 📲 Browser result:', result.type, result.url)

    if (result.type === 'success' && result.url) {
      // Parse tokens from URL
      const hashParams = new URLSearchParams(result.url.split('#')[1] || '')
      const queryParams = new URLSearchParams(
        result.url.split('?')[1]?.split('#')[0] || '',
      )

      const accessToken =
        hashParams.get('access_token') || queryParams.get('access_token')
      const refreshToken =
        hashParams.get('refresh_token') || queryParams.get('refresh_token')

      if (accessToken && refreshToken) {
        const { data: sessionData } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        // If signInOnly mode, check if this is a new account
        if (signInOnly && sessionData.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', sessionData.user.id)
            .single()

          // If no profile exists, this is a new account - reject it
          if (!profile) {
            // Sign out the newly created user
            await supabase.auth.signOut()
            throw new Error("It looks like you don't have an account yet. Please sign up first.")
          }
        }

        posthog?.capture('Auth Login', {
          method: 'google',
        })
      } else {
        throw new Error('No tokens received from OAuth')
      }
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('Sign in cancelled')
    }
  }

  const signInWithApple = async (signInOnly = false) => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS')
    }

    try {
      // Generate and hash nonce
      const nonce = Math.random().toString(36).substring(2, 10)
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      )

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      })

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple')
      }

      // Sign in to Supabase with Apple token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce,
      })

      if (error) throw error

      // If signInOnly mode, check if this is a new account
      if (signInOnly && data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single()

        // If no profile exists, this is a new account - reject it
        if (!profile) {
          // Sign out the newly created user
          await supabase.auth.signOut()
          throw new Error("It looks like you don't have an account yet. Please sign up first.")
        }
      }

      posthog?.capture('Auth Login', {
        method: 'apple',
      })
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        throw new Error('Sign in cancelled')
      }
      throw e
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    posthog?.capture('Auth Logout', {
      timestamp: Date.now(),
    })
    posthog?.reset() // Clear user identity on logout
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
