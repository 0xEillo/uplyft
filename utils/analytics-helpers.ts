/**
 * Analytics Helper Functions and Utilities
 *
 * Provides type-safe wrappers and utilities for analytics tracking.
 */

import {
  AnalyticsEvents,
  type BaseEventProperties,
  type EventPropertiesMap,
} from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useEffect, useRef } from 'react'

// ============================================================================
// TYPED TRACKING FUNCTIONS
// ============================================================================

/**
 * Type-safe event tracking hook
 * Usage: const { track } = useTypedAnalytics()
 *        track(AnalyticsEvents.FEED_VIEWED, { workoutCount: 10 })
 */
export function useTypedAnalytics() {
  const { trackEvent } = useAnalytics()

  const track = <K extends keyof EventPropertiesMap>(
    event: K,
    properties?: EventPropertiesMap[K]
  ) => {
    return trackEvent(event, properties as Record<string, unknown>)
  }

  return { track }
}

// ============================================================================
// SCREEN VIEW TRACKING
// ============================================================================

/**
 * Automatically tracks screen views when component mounts and on focus
 *
 * @param screenName - Name of the screen
 * @param properties - Additional properties to track
 * @param options - Configuration options
 *
 * @example
 * useScreenView('Feed', { workoutCount: workouts.length })
 */
export function useScreenView(
  screenName: string,
  properties?: BaseEventProperties,
  options?: {
    trackOnMount?: boolean // Default: true
    trackOnFocus?: boolean // Default: true (requires useFocusEffect from @react-navigation)
  }
) {
  const { trackEvent } = useAnalytics()
  const hasTrackedMount = useRef(false)

  const trackOnMount = options?.trackOnMount !== false
  const trackOnFocus = options?.trackOnFocus !== false

  useEffect(() => {
    if (trackOnMount && !hasTrackedMount.current) {
      trackEvent(AnalyticsEvents.SCREEN_VIEWED, {
        screen_name: screenName,
        timestamp: Date.now(),
        ...properties,
      })
      hasTrackedMount.current = true
    }
  }, [screenName, trackEvent, trackOnMount, properties])

  // Return function to manually trigger tracking (useful with useFocusEffect)
  return () => {
    if (trackOnFocus) {
      trackEvent(AnalyticsEvents.SCREEN_VIEWED, {
        screen_name: screenName,
        timestamp: Date.now(),
        ...properties,
      })
    }
  }
}

// ============================================================================
// ERROR TRACKING
// ============================================================================

export interface ErrorTrackingOptions {
  errorType?: 'api' | 'network' | 'transcription' | 'image_scan' | 'unknown'
  endpoint?: string
  statusCode?: number
  silent?: boolean // Don't throw the error, just track it
}

/**
 * Tracks errors and optionally re-throws them
 *
 * @example
 * const trackError = useErrorTracker()
 * try {
 *   await apiCall()
 * } catch (error) {
 *   trackError(error, { errorType: 'api', endpoint: '/workouts' })
 * }
 */
export function useErrorTracker() {
  const { trackEvent } = useAnalytics()

  return (error: unknown, options?: ErrorTrackingOptions) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorType = options?.errorType || 'unknown'

    const eventName =
      errorType === 'network'
        ? AnalyticsEvents.NETWORK_ERROR
        : errorType === 'api'
          ? AnalyticsEvents.API_ERROR
          : errorType === 'transcription'
            ? AnalyticsEvents.TRANSCRIPTION_FAILED
            : errorType === 'image_scan'
              ? AnalyticsEvents.IMAGE_SCAN_FAILED
              : AnalyticsEvents.API_ERROR

    trackEvent(eventName, {
      error_type: errorType,
      error_message: errorMessage,
      endpoint: options?.endpoint,
      status_code: options?.statusCode,
      timestamp: Date.now(),
    })

    if (!options?.silent) {
      throw error
    }
  }
}

/**
 * Wraps an async function with error tracking
 *
 * @example
 * const fetchWithTracking = withErrorTracking(
 *   async () => await fetch('/api/workouts'),
 *   { errorType: 'api', endpoint: '/api/workouts' }
 * )
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: ErrorTrackingOptions
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      const { trackEvent } = useAnalytics()
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorType = options?.errorType || 'unknown'

      const eventName =
        errorType === 'network'
          ? AnalyticsEvents.NETWORK_ERROR
          : errorType === 'api'
            ? AnalyticsEvents.API_ERROR
            : AnalyticsEvents.API_ERROR

      trackEvent(eventName, {
        error_type: errorType,
        error_message: errorMessage,
        endpoint: options?.endpoint,
        status_code: options?.statusCode,
        timestamp: Date.now(),
      })

      throw error
    }
  }) as T
}

// ============================================================================
// FEATURE GATE TRACKING
// ============================================================================

export type FeatureGateType = 'workout_logging' | 'voice_logging' | 'body_scan' | 'ai_chat'

/**
 * Tracks paywall interactions for feature gates
 *
 * @example
 * const { trackPaywallShown, trackPaywallDismissed, trackPaywallPurchased } = useFeatureGate()
 *
 * if (!isPro) {
 *   trackPaywallShown('voice_logging', 'create-speech')
 *   router.push('/trial-offer')
 * }
 */
export function useFeatureGate() {
  const { trackEvent } = useAnalytics()

  const trackPaywallShown = (
    feature: FeatureGateType,
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

  const trackPaywallCTATapped = (feature: FeatureGateType, sourceScreen?: string) => {
    trackEvent(AnalyticsEvents.PAYWALL_CTA_TAPPED, {
      feature,
      source_screen: sourceScreen,
      action: 'cta_tapped',
      timestamp: Date.now(),
    })
  }

  const trackPaywallDismissed = (feature: FeatureGateType, sourceScreen?: string) => {
    trackEvent(AnalyticsEvents.PAYWALL_DISMISSED, {
      feature,
      source_screen: sourceScreen,
      action: 'dismissed',
      timestamp: Date.now(),
    })
  }

  const trackPaywallPurchased = (feature: FeatureGateType, sourceScreen?: string) => {
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

// ============================================================================
// PERFORMANCE TRACKING
// ============================================================================

/**
 * Tracks performance of an operation
 *
 * @example
 * const trackPerformance = usePerformanceTracker()
 * const endTracking = trackPerformance('transcription')
 * await transcribeAudio()
 * endTracking(true) // Pass success/failure
 */
export function usePerformanceTracker() {
  const { trackEvent } = useAnalytics()

  return (operation: string) => {
    const startTime = Date.now()

    return (success: boolean = true, properties?: Record<string, unknown>) => {
      const duration = Date.now() - startTime

      trackEvent('Performance Tracked', {
        operation,
        duration,
        success,
        timestamp: Date.now(),
        ...properties,
      })
    }
  }
}

/**
 * Wraps an async function with performance tracking
 *
 * @example
 * const transcribeWithTracking = withPerformanceTracking(
 *   transcribeAudio,
 *   'audio_transcription'
 * )
 */
export async function withPerformanceTracking<T>(
  fn: () => Promise<T>,
  operation: string,
  trackEvent: (event: string, properties?: Record<string, unknown>) => Promise<void>
): Promise<T> {
  const startTime = Date.now()
  let success = true

  try {
    const result = await fn()
    return result
  } catch (error) {
    success = false
    throw error
  } finally {
    const duration = Date.now() - startTime
    await trackEvent('Performance Tracked', {
      operation,
      duration,
      success,
      timestamp: Date.now(),
    })
  }
}

// ============================================================================
// DEBOUNCED TRACKING
// ============================================================================

/**
 * Creates a debounced event tracker (useful for auto-save, search, etc.)
 *
 * @example
 * const trackDraftSave = useDebouncedTracking(
 *   AnalyticsEvents.WORKOUT_DRAFT_AUTO_SAVED,
 *   2500
 * )
 *
 * // In your onChange handler:
 * trackDraftSave({ length: text.length })
 */
export function useDebouncedTracking(eventName: string, delay: number = 2000) {
  const { trackEvent } = useAnalytics()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (properties?: Record<string, unknown>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      trackEvent(eventName, {
        timestamp: Date.now(),
        ...properties,
      })
    }, delay)
  }
}

// ============================================================================
// SESSION TRACKING
// ============================================================================

export { clearSession, getSessionId } from './analytics-common'

// ============================================================================
// PROPERTY FILTERING
// ============================================================================

export { filterProperties } from './analytics-common'

// ============================================================================
// VALIDATION (Development only)
// ============================================================================

export { validateEventProperties } from './analytics-common'
