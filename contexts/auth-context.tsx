import { FacebookEvents } from '@/lib/facebook-sdk'
import { mixpanel } from '@/lib/mixpanel'
import { supabase } from '@/lib/supabase'
import { Session, User } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import { makeRedirectUri } from 'expo-auth-session'
import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from 'react'
import { Platform } from 'react-native'

WebBrowser.maybeCompleteAuthSession()

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAnonymous: boolean
  isAuthTransitioning: boolean
  signUp: (email: string, password: string) => Promise<{ userId: string }>
  signIn: (email: string, password: string) => Promise<void>
  signInAnonymously: () => Promise<{ userId: string }>
  signInWithGoogle: (signInOnly?: boolean) => Promise<void>
  signInWithApple: (signInOnly?: boolean) => Promise<void>
  linkWithGoogle: () => Promise<void>
  linkWithApple: () => Promise<void>
  linkWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROVIDER_AVATAR_METADATA_KEYS = [
  'avatar_url',
  'picture',
  'photo_url',
  'profile_image_url',
  'image',
] as const

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const extractProviderAvatarUrl = (authUser: User): string | null => {
  const metadataSources: (Record<string, unknown> | null)[] = [
    toRecord(authUser.user_metadata),
    ...(authUser.identities ?? []).map((identity) =>
      toRecord(identity.identity_data),
    ),
  ]

  for (const source of metadataSources) {
    if (!source) continue

    for (const key of PROVIDER_AVATAR_METADATA_KEYS) {
      const value = toNonEmptyString(source[key])
      if (!value) continue

      if (/^https?:\/\//i.test(value)) {
        return value
      }
    }
  }

  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authTransitionCount, setAuthTransitionCount] = useState(0)

  // Check if user is anonymous (guest mode)
  const isAnonymous = user?.is_anonymous === true
  const isAuthTransitioning = authTransitionCount > 0

  useEffect(() => {
    // Get initial session (works offline - Supabase caches session locally)
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      })
      .catch((error) => {
        // Session retrieval failed (rare - usually works offline from cache)
        console.error('[Auth] Failed to get session:', error)
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

  const syncProviderAvatarIfMissing = async (authUser: User | null) => {
    if (!authUser) return

    const providerAvatarUrl = extractProviderAvatarUrl(authUser)
    if (!providerAvatarUrl) return

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', authUser.id)
        .maybeSingle()

      if (profileError) {
        console.warn(
          '[Auth] Could not check existing avatar before provider sync:',
          profileError,
        )
        return
      }

      if (!profile || profile.avatar_url?.trim()) return

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: providerAvatarUrl })
        .eq('id', authUser.id)

      if (updateError) {
        console.warn('[Auth] Failed to sync provider avatar:', updateError)
      }
    } catch (error) {
      console.warn('[Auth] Failed to sync provider avatar:', error)
    }
  }

  const runDuringAuthTransition = async <T,>(operation: () => Promise<T>) => {
    setAuthTransitionCount((count) => count + 1)

    try {
      return await operation()
    } finally {
      setAuthTransitionCount((count) => Math.max(0, count - 1))
    }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error
    if (!data.user) throw new Error('No user returned from signup')

    mixpanel.track('Auth Sign Up', {
      method: 'password',
      userId: data.user.id,
      email: email.toLowerCase(),
    })

    // Log to Facebook for ad attribution
    FacebookEvents.logCompletedRegistration('email')
    FacebookEvents.setUserID(data.user.id)
    FacebookEvents.setUserData({ email: email.toLowerCase() })

    return { userId: data.user.id }
  }

  const signIn = async (email: string, password: string) => {
    await runDuringAuthTransition(async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      mixpanel.track('Auth Login', {
        method: 'password',
        email: email.toLowerCase(),
      })
    })
  }

  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously()

    if (error) throw error
    if (!data.user) throw new Error('No user returned from anonymous sign-in')

    // Ensure profile exists for this anonymous user
    // The trigger may not have run or failed, so we create one if needed
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!existingProfile) {
      const baseTag = 'guest' + data.user.id.replace(/-/g, '').substring(0, 8)
      const profileData: {
        id: string
        user_tag: string
        display_name: string
        is_guest?: boolean
      } = {
        id: data.user.id,
        user_tag: baseTag,
        display_name: 'Guest',
        is_guest: true,
      }

      const { error: insertError } = await supabase
        .from('profiles')
        .insert(profileData)

      if (insertError) {
        // Handle missing column (migration not run yet)
        if (insertError.code === 'PGRST204' && profileData.is_guest) {
          console.warn(
            'is_guest column missing, retrying without it. Please run migrations.',
          )
          delete profileData.is_guest
          const { error: retryError } = await supabase
            .from('profiles')
            .insert(profileData)
          if (retryError) {
            console.error('Failed to create guest profile (retry):', retryError)
          }
        } else {
          console.error('Failed to create guest profile:', insertError)
        }
      }
    }

    mixpanel.track('Auth Anonymous Sign In', {
      userId: data.user.id,
    })

    // Log to Facebook for ad attribution (anonymous users are still acquisitions!)
    FacebookEvents.logCompletedRegistration('anonymous')
    FacebookEvents.setUserID(data.user.id)

    return { userId: data.user.id }
  }

  const signInWithGoogle = async (signInOnly = false) => {
    await runDuringAuthTransition(async () => {
      const redirectUrl = makeRedirectUri({
        scheme: 'repai',
        path: 'auth/callback',
      })

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (error) {
        throw error
      }

      if (!data.url) {
        throw new Error('No OAuth URL generated')
      }

      // Open OAuth in browser - works with standalone builds only
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

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
              throw new Error(
                "It looks like you don't have an account yet. Please sign up first.",
              )
            }
          }

          await syncProviderAvatarIfMissing(sessionData.user ?? null)

          mixpanel.track('Auth Login', {
            method: 'google',
          })
        } else {
          throw new Error('No tokens received from OAuth')
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Sign in cancelled')
      } else {
        throw new Error('Sign in failed')
      }
    })
  }

  const signInWithApple = async (signInOnly = false) => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS')
    }

    await runDuringAuthTransition(async () => {
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
            throw new Error(
              "It looks like you don't have an account yet. Please sign up first.",
            )
          }
        }

        await syncProviderAvatarIfMissing(data.user ?? null)

        mixpanel.track('Auth Login', {
          method: 'apple',
        })
      } catch (e) {
        if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
          throw new Error('Sign in cancelled')
        }
        throw e
      }
    })
  }

  // Link anonymous account with Google (upgrade to permanent)
  const linkWithGoogle = async () => {
    if (!user?.is_anonymous) {
      throw new Error('Can only link from anonymous account')
    }

    await runDuringAuthTransition(async () => {
      const redirectUrl = makeRedirectUri({
        scheme: 'repai',
        path: 'auth/callback',
      })

      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (error) throw error

      if (!data.url) {
        throw new Error('No OAuth URL generated')
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

      if (result.type === 'success' && result.url) {
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

          await syncProviderAvatarIfMissing(sessionData.user ?? null)

          mixpanel.track('Auth Account Linked', {
            method: 'google',
          })

          // Log to Facebook for ad attribution (account link = registration)
          FacebookEvents.logCompletedRegistration('google')
          if (sessionData.user) {
            FacebookEvents.setUserID(sessionData.user.id)
            if (sessionData.user.email) {
              FacebookEvents.setUserData({ email: sessionData.user.email.toLowerCase() })
            }
          }
        } else {
          throw new Error('No tokens received from OAuth')
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Account linking cancelled')
      } else {
        throw new Error('Account linking failed')
      }
    })
  }

  // Link anonymous account with Apple (upgrade to permanent)
  const linkWithApple = async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS')
    }

    if (!user?.is_anonymous) {
      throw new Error('Can only link from anonymous account')
    }

    await runDuringAuthTransition(async () => {
      try {
        const nonce = Math.random().toString(36).substring(2, 10)
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          nonce,
        )

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

        // Use linkIdentity for Apple
        const { error } = await supabase.auth.linkIdentity({
          provider: 'apple',
          options: {
            skipBrowserRedirect: true,
          },
        })

        // If linkIdentity doesn't work for native Apple, fall back to updating user
        if (error) {
          // Alternative: sign in with the Apple token to merge
          const { error: signInError } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce,
          })

          if (signInError) throw signInError
        }

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        await syncProviderAvatarIfMissing(authUser ?? user ?? null)

        mixpanel.track('Auth Account Linked', {
          method: 'apple',
        })

        // Log to Facebook for ad attribution (account link = registration)
        FacebookEvents.logCompletedRegistration('apple')
        if (user) {
          FacebookEvents.setUserID(user.id)
          if (user.email) {
            FacebookEvents.setUserData({ email: user.email.toLowerCase() })
          }
        }
      } catch (e) {
        if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
          throw new Error('Account linking cancelled')
        }
        throw e
      }
    })
  }

  // Link anonymous account with email/password (upgrade to permanent)
  const linkWithEmail = async (email: string, password: string) => {
    if (!user?.is_anonymous) {
      throw new Error('Can only link from anonymous account')
    }

    await runDuringAuthTransition(async () => {
      // Update the anonymous user with email and password
      const { error } = await supabase.auth.updateUser({
        email,
        password,
      })

      if (error) throw error

      mixpanel.track('Auth Account Linked', {
        method: 'email',
        email: email.toLowerCase(),
      })

      // Log to Facebook for ad attribution (account link = registration)
      FacebookEvents.logCompletedRegistration('email')
      if (user) {
        FacebookEvents.setUserID(user.id)
        FacebookEvents.setUserData({ email: email.toLowerCase() })
      }
    })
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    mixpanel.track('Auth Logout', {
      timestamp: Date.now(),
    })
    mixpanel.reset() // Clear user identity on logout

    // Clear Facebook user data
    FacebookEvents.clearUserID()
    FacebookEvents.clearUserData()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAnonymous,
        isAuthTransitioning,
        signUp,
        signIn,
        signInAnonymously,
        signInWithGoogle,
        signInWithApple,
        linkWithGoogle,
        linkWithApple,
        linkWithEmail,
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
