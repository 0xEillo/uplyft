import { mixpanel } from '@/lib/mixpanel'
import { getSessionId } from '@/utils/analytics-common'
import Constants from 'expo-constants'
import React, { createContext, ReactNode, useContext, useEffect } from 'react'
import { Platform } from 'react-native'
import { useAuth } from './auth-context'

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
  const { user } = useAuth()

  // Identify user when they sign in
  useEffect(() => {
    if (user) {
      const properties: Record<string, any> = {
        $email: user.email || undefined,
        $name: user.user_metadata?.name || undefined,
      }
      // Filter out undefined values
      const filteredProps = Object.fromEntries(
        Object.entries(properties).filter(([_, v]) => v !== undefined)
      )
      mixpanel.identify(user.id)
      mixpanel.getPeople().set(filteredProps)
    }
  }, [user])

  // Register super properties for all events
  useEffect(() => {
    const properties: Record<string, any> = {
      appVersion: Constants.expoConfig?.version || 'unknown',
      platform: Platform.OS,
      platformVersion: Platform.Version?.toString?.() ?? 'unknown',
    }
    // Filter out undefined values
    const filteredProps = Object.fromEntries(
      Object.entries(properties).filter(([_, v]) => v !== undefined)
    )
    mixpanel.registerSuperProperties(filteredProps)
  }, [])

  const value: AnalyticsContextValue = {
    trackEvent: async (event: string, payload?: Record<string, unknown>) => {
      try {
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

        mixpanel.track(event, filteredPayload)
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
        if (!distinctId || distinctId.trim() === '') {
          if (__DEV__) {
            console.error('[Analytics] distinctId cannot be empty')
          }
          return
        }

        mixpanel.identify(distinctId)

        if (payload) {
          // Filter out undefined values from payload
          const filteredPayload = Object.fromEntries(
            Object.entries(payload).filter(([_, v]) => v !== undefined)
          ) as any
          mixpanel.getPeople().set(filteredPayload)
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
