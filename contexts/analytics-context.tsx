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
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.name,
      })
    }
  }, [user, posthog])

  // Register super properties for all events
  useEffect(() => {
    if (posthog) {
      posthog.register({
        appVersion: Constants.expoConfig?.version,
        platform: Platform.OS,
        platformVersion: Platform.Version?.toString?.() ?? 'unknown',
      })
    }
  }, [posthog])

  const value: AnalyticsContextValue = {
    trackEvent: async (event: string, payload?: Record<string, unknown>) => {
      if (posthog) {
        posthog.capture(event, payload)
      }
    },
    identifyUser: async (
      distinctId: string,
      payload?: Record<string, unknown>,
    ) => {
      if (posthog) {
        posthog.identify(distinctId, payload)
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
