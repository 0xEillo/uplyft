import { supabase } from '@/lib/supabase'
import { Session, User } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import { usePostHog } from 'posthog-react-native'
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
  signInWithGoogle: () => Promise<void>
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

  const signInWithGoogle = async () => {
    console.log('=== Google OAuth Debug ===')

    // Use repai:// for standalone builds
    const redirectUrl = 'repai://'

    console.log('Generated redirect URL:', redirectUrl)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (error) {
      console.log('OAuth error:', error)
      throw error
    }

    console.log('OAuth URL:', data.url)

    if (!data.url) {
      throw new Error('No OAuth URL generated')
    }

    // Open OAuth in browser - works with standalone builds only
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

    console.log('Browser result:', result)

    if (result.type === 'success' && result.url) {
      console.log('Success URL:', result.url)
      // Parse tokens from URL
      const hashParams = new URLSearchParams(result.url.split('#')[1] || '')
      const queryParams = new URLSearchParams(
        result.url.split('?')[1]?.split('#')[0] || '',
      )

      const accessToken =
        hashParams.get('access_token') || queryParams.get('access_token')
      const refreshToken =
        hashParams.get('refresh_token') || queryParams.get('refresh_token')

      console.log('Has access token:', !!accessToken)
      console.log('Has refresh token:', !!refreshToken)

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

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
