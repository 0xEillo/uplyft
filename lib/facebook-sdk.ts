import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency'
import { Platform } from 'react-native'
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next'

type Params = Record<string, string | number>

/**
 * Initialize Facebook SDK (called early, but NO tracking until ATT consent)
 * Since isAutoInitEnabled=false, we must manually initialize.
 */
export async function initializeFacebookSDK() {
  try {
    // Initialize the SDK (no events are logged yet due to autoLogAppEventsEnabled=false)
    await Settings.initializeSDK()

    // On Android, enable tracking immediately (no ATT required)
    if (Platform.OS === 'android') {
      await Settings.setAdvertiserTrackingEnabled(true)
    }

    if (__DEV__) {
      console.log(
        '[FacebookSDK] Initialized (tracking disabled until ATT consent)',
      )
    }
  } catch (error) {
    // SDK not available or initialization failed - fail silently
    if (__DEV__) {
      console.log(
        '[FacebookSDK] SDK not available or initialization failed:',
        error,
      )
    }
  }
}

/**
 * Request App Tracking Transparency permission and enable Facebook tracking if granted.
 * Call this AFTER showing the user some context (e.g., after onboarding).
 * Returns true if tracking was enabled, false otherwise.
 */
export async function requestTrackingPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    // Android doesn't need ATT - already enabled in initializeFacebookSDK
    return true
  }

  try {
    // Check if already determined
    const { status: currentStatus } = await getTrackingPermissionsAsync()

    if (currentStatus === 'granted') {
      // Already granted - enable full tracking
      await Settings.setAdvertiserTrackingEnabled(true)
      await Settings.setAdvertiserIDCollectionEnabled(true)
      if (__DEV__)
        console.log('[FacebookSDK] Tracking already granted, enabled')
      return true
    }

    if (currentStatus === 'denied') {
      // Already denied - respect the decision
      await Settings.setAdvertiserTrackingEnabled(false)
      if (__DEV__) console.log('[FacebookSDK] Tracking previously denied')
      return false
    }

    // Status is 'undetermined' - show the ATT popup
    const { status } = await requestTrackingPermissionsAsync()
    const granted = status === 'granted'

    // Enable/disable tracking based on user choice
    await Settings.setAdvertiserTrackingEnabled(granted)
    if (granted) {
      await Settings.setAdvertiserIDCollectionEnabled(true)
    }

    if (__DEV__) {
      console.log(`[FacebookSDK] ATT result: ${status}, tracking: ${granted}`)
    }

    return granted
  } catch (error) {
    if (__DEV__) {
      console.error('[FacebookSDK] ATT request error:', error)
    }
    return false
  }
}

/**
 * Log standard Facebook events for ad optimization
 */
export const FacebookEvents = {
  /**
   * Log when user completes registration/signup
   */
  logCompletedRegistration: (registrationMethod?: string) => {
    try {
      AppEventsLogger.logEvent('fb_mobile_complete_registration', {
        fb_registration_method: registrationMethod ?? 'email',
      })
    } catch (error) {
      // SDK not available - fail silently
      if (__DEV__)
        console.error('[FacebookSDK] logCompletedRegistration error:', error)
    }
  },

  /**
   * Log when user starts a subscription trial
   */
  logStartTrial: (trialType?: string, currency = 'USD', value = 0) => {
    try {
      AppEventsLogger.logEvent('StartTrial', value, {
        fb_currency: currency,
        fb_content_type: trialType ?? 'subscription',
      })
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] logStartTrial error:', error)
    }
  },

  /**
   * Log when user subscribes (purchase)
   */
  logSubscribe: (
    amount: number,
    currency = 'USD',
    subscriptionType?: string,
  ) => {
    try {
      AppEventsLogger.logPurchase(amount, currency, {
        fb_content_type: subscriptionType ?? 'subscription',
      })
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] logSubscribe error:', error)
    }
  },

  /**
   * Log when user initiates checkout
   */
  logInitiatedCheckout: (
    amount: number,
    currency = 'USD',
    contentType?: string,
  ) => {
    try {
      AppEventsLogger.logEvent('fb_mobile_initiated_checkout', amount, {
        fb_currency: currency,
        fb_content_type: contentType ?? 'subscription',
      })
    } catch (error) {
      if (__DEV__)
        console.error('[FacebookSDK] logInitiatedCheckout error:', error)
    }
  },

  /**
   * Log when user completes a workout (custom event for engagement)
   */
  logCompletedWorkout: (workoutData?: Params) => {
    try {
      if (workoutData) {
        AppEventsLogger.logEvent('CompletedWorkout', workoutData)
      } else {
        AppEventsLogger.logEvent('CompletedWorkout')
      }
    } catch (error) {
      if (__DEV__)
        console.error('[FacebookSDK] logCompletedWorkout error:', error)
    }
  },

  /**
   * Log when user achieves a level/milestone
   */
  logAchievedLevel: (level: string) => {
    try {
      AppEventsLogger.logEvent('fb_mobile_level_achieved', {
        fb_level: level,
      })
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] logAchievedLevel error:', error)
    }
  },

  /**
   * Log content view (e.g., viewing a specific screen)
   */
  logViewContent: (
    contentType: string,
    contentId?: string,
    contentName?: string,
  ) => {
    try {
      const params: Params = { fb_content_type: contentType }
      if (contentId) params.fb_content_id = contentId
      if (contentName) params.fb_content = contentName
      AppEventsLogger.logEvent('fb_mobile_content_view', params)
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] logViewContent error:', error)
    }
  },

  /**
   * Log custom event
   */
  logCustomEvent: (
    eventName: string,
    valueToSum?: number,
    parameters?: Params,
  ) => {
    try {
      if (valueToSum !== undefined && parameters) {
        AppEventsLogger.logEvent(eventName, valueToSum, parameters)
      } else if (valueToSum !== undefined) {
        AppEventsLogger.logEvent(eventName, valueToSum)
      } else if (parameters) {
        AppEventsLogger.logEvent(eventName, parameters)
      } else {
        AppEventsLogger.logEvent(eventName)
      }
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] logCustomEvent error:', error)
    }
  },

  /**
   * Set user data for advanced matching (helps with attribution)
   * Call this after user provides their email or other info
   */
  setUserData: (userData: {
    email?: string
    firstName?: string
    lastName?: string
    phone?: string
    dateOfBirth?: string // YYYYMMDD
    gender?: 'm' | 'f'
    city?: string
    state?: string
    zip?: string
    country?: string // Two-letter country code
  }) => {
    try {
      AppEventsLogger.setUserData(userData)
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] setUserData error:', error)
    }
  },

  /**
   * Clear user data (e.g., on logout)
   * Note: SDK doesn't have clearUserData, so we set empty values
   */
  clearUserData: () => {
    try {
      AppEventsLogger.setUserData({})
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] clearUserData error:', error)
    }
  },

  /**
   * Set user ID for cross-platform tracking
   */
  setUserID: (userId: string) => {
    try {
      AppEventsLogger.setUserID(userId)
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] setUserID error:', error)
    }
  },

  /**
   * Clear user ID (e.g., on logout)
   */
  clearUserID: () => {
    try {
      AppEventsLogger.clearUserID()
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] clearUserID error:', error)
    }
  },

  /**
   * Flush events immediately (useful before app goes to background)
   */
  flush: () => {
    try {
      AppEventsLogger.flush()
    } catch (error) {
      if (__DEV__) console.error('[FacebookSDK] flush error:', error)
    }
  },
}
