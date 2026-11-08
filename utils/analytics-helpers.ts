/**
 * Analytics Helper Functions and Utilities
 *
 * Provides type-safe wrappers and utilities for analytics tracking.
 */

import {
  AnalyticsEvents,
  type PaywallFeature,
} from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'

// ============================================================================
// FEATURE GATE TRACKING
// ============================================================================

/** @deprecated Use `PaywallFeature` from `constants/analytics-events`. */
export type FeatureGateType = PaywallFeature

/**
 * Tracks paywall interactions for feature gates.
 *
 * Single helper that every paywall trigger in the app should call so the
 * `PAYWALL_SHOWN` / `PAYWALL_DISMISSED` / `PAYWALL_PURCHASED` funnel is
 * consistent. Pair with `<Paywall onClose>` to fire `dismissed`.
 *
 * @example
 * const { trackPaywallShown } = useFeatureGate()
 *
 * if (!isPro) {
 *   trackPaywallShown('voice_logging', 'create-speech')
 *   setPaywallVisible(true)
 * }
 */
export function useFeatureGate() {
  const { trackEvent } = useAnalytics()

  const trackPaywallShown = (
    feature: PaywallFeature,
    sourceScreen?: string,
    subscriptionStatus?: 'active' | 'trial' | 'expired' | 'none'
  ) => {
    trackEvent(AnalyticsEvents.PAYWALL_SHOWN, {
      feature,
      source_screen: sourceScreen,
      subscription_status: subscriptionStatus,
      action: 'shown',
      timestamp: Date.now(),
    })
  }

  const trackPaywallCTATapped = (
    feature: PaywallFeature,
    sourceScreen?: string,
  ) => {
    trackEvent(AnalyticsEvents.PAYWALL_CTA_TAPPED, {
      feature,
      source_screen: sourceScreen,
      action: 'cta_tapped',
      timestamp: Date.now(),
    })
  }

  const trackPaywallDismissed = (
    feature: PaywallFeature,
    sourceScreen?: string,
  ) => {
    trackEvent(AnalyticsEvents.PAYWALL_DISMISSED, {
      feature,
      source_screen: sourceScreen,
      action: 'dismissed',
      timestamp: Date.now(),
    })
  }

  const trackPaywallPurchased = (
    feature: PaywallFeature,
    sourceScreen?: string,
  ) => {
    trackEvent(AnalyticsEvents.PAYWALL_PURCHASED, {
      feature,
      source_screen: sourceScreen,
      action: 'purchased',
      timestamp: Date.now(),
    })
  }

  return {
    trackPaywallShown,
    trackPaywallCTATapped,
    trackPaywallDismissed,
    trackPaywallPurchased,
  }
}
