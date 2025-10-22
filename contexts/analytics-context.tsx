import React, { createContext, ReactNode, useContext, useEffect } from 'react'
import { usePostHog } from 'posthog-react-native'
import { useAuth } from './auth-context'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

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
      if (posthog && payload) {
        // Filter out undefined values from payload
        const filteredPayload = Object.fromEntries(
          Object.entries(payload).filter(([_, v]) => v !== undefined)
        ) as any
        posthog.capture(event, filteredPayload)
      } else if (posthog) {
        posthog.capture(event)
      }
    },
    identifyUser: async (
      distinctId: string,
      payload?: Record<string, unknown>,
    ) => {
      if (posthog && payload) {
        // Filter out undefined values from payload
        const filteredPayload = Object.fromEntries(
          Object.entries(payload).filter(([_, v]) => v !== undefined)
        ) as any
        posthog.identify(distinctId, filteredPayload)
      } else if (posthog) {
        posthog.identify(distinctId)
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
