import React, { createContext, ReactNode, useContext, useEffect } from 'react'
import { usePostHog } from 'posthog-react-native'
import { useAuth } from './auth-context'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { getSessionId } from '@/utils/analytics-common'

type AnalyticsContextValue = {
  trackEvent: (event: string, payload?: Record<string, unknown>) => Promise<void>
  identifyUser: (
    distinctId: string,
    payload?: Record<string, unknown>,
  ) => Promise<void>
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(
  undefined,
)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog()
  const { user } = useAuth()

  // Identify user when they sign in
  useEffect(() => {
    if (user && posthog) {
      const properties: Record<string, any> = {
        email: user.email || undefined,
        name: user.user_metadata?.name || undefined,
      }
      // Filter out undefined values
      const filteredProps = Object.fromEntries(
        Object.entries(properties).filter(([_, v]) => v !== undefined)
      )
      posthog.identify(user.id, filteredProps)
    }
  }, [user, posthog])

  // Register super properties for all events
  useEffect(() => {
    if (posthog) {
      const properties: Record<string, any> = {
        appVersion: Constants.expoConfig?.version || 'unknown',
        platform: Platform.OS,
        platformVersion: Platform.Version?.toString?.() ?? 'unknown',
      }
      // Filter out undefined values
      const filteredProps = Object.fromEntries(
        Object.entries(properties).filter(([_, v]) => v !== undefined)
      )
      posthog.register(filteredProps)
    }
  }, [posthog])

  const value: AnalyticsContextValue = {
    trackEvent: async (event: string, payload?: Record<string, unknown>) => {
      try {
        if (!posthog) {
          // PostHog not available - fail silently in production
          if (__DEV__) {
            console.warn('[Analytics] PostHog not initialized, event not tracked:', event)
          }
          return
        }

        // Add session ID and timestamp to all events
        const enrichedPayload = {
          ...payload,
          session_id: getSessionId(),
          timestamp: payload?.timestamp || Date.now(),
        }

        // Filter out undefined values from payload
        const filteredPayload = Object.fromEntries(
          Object.entries(enrichedPayload).filter(([_, v]) => v !== undefined)
        ) as any

        // Validate in development
        if (__DEV__) {
          if (!event || event.trim() === '') {
            console.error('[Analytics] Event name cannot be empty')
            return
          }
          if (Object.keys(filteredPayload).length === 0) {
            console.warn(
              `[Analytics] Event "${event}" has no properties. Consider adding context.`
            )
          }
        }

        posthog.capture(event, filteredPayload)
      } catch (error) {
        // Never let analytics errors crash the app
        if (__DEV__) {
          console.error('[Analytics] Error tracking event:', event, error)
        }
      }
    },
    identifyUser: async (
      distinctId: string,
      payload?: Record<string, unknown>,
    ) => {
      try {
        if (!posthog) {
          if (__DEV__) {
            console.warn('[Analytics] PostHog not initialized, user not identified')
          }
          return
        }

        if (!distinctId || distinctId.trim() === '') {
          if (__DEV__) {
            console.error('[Analytics] distinctId cannot be empty')
          }
          return
        }

        if (payload) {
          // Filter out undefined values from payload
          const filteredPayload = Object.fromEntries(
            Object.entries(payload).filter(([_, v]) => v !== undefined)
          ) as any
          posthog.identify(distinctId, filteredPayload)
        } else {
          posthog.identify(distinctId)
        }
      } catch (error) {
        // Never let analytics errors crash the app
        if (__DEV__) {
          console.error('[Analytics] Error identifying user:', error)
        }
      }
    },
  }

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider')
  }
  return context
}
