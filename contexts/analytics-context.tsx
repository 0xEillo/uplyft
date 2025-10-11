import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useUnit } from '@/contexts/unit-context'
import Constants from 'expo-constants'
import React, { createContext, ReactNode, useContext, useEffect } from 'react'
import { Platform } from 'react-native'

import {
  clearSuperProperties,
  guessPlatform,
  identify,
  registerSuperProperties,
  track,
  withMixpanel,
} from '@/lib/analytics/mixpanel'

type AnalyticsContextValue = {
  trackEvent: typeof track
  identifyUser: typeof identify
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(
  undefined,
)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const { weightUnit } = useUnit()
  const unitSystem = weightUnit

  useEffect(() => {
    const appVersion = Constants.expoConfig?.version
    const appBuild = Constants.expoConfig?.ios?.buildNumber
    const platform = guessPlatform()
    const platformVersion = Platform.Version?.toString?.() ?? 'unknown'

    registerSuperProperties({
      appVersion,
      appBuild,
      platform,
      platformVersion,
      theme: isDark ? 'dark' : 'light',
      unitSystem,
    })

    return () => {
      clearSuperProperties()
    }
  }, [isDark, unitSystem])

  useEffect(() => {
    if (!user) {
      return
    }
    identify(user.id, {
      email: user.email || undefined,
      name: user.user_metadata?.name,
      goal: user.user_metadata?.goal,
      unit_system: unitSystem,
    }).catch((err) => {
      console.warn('mixpanel identify error', err)
    })
  }, [user, unitSystem])

  const value: AnalyticsContextValue = {
    trackEvent: track,
    identifyUser: identify,
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

export const MixpanelClient = {
  withInstance: withMixpanel,
}
