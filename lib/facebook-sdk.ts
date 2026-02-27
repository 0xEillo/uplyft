import {
    getTrackingPermissionsAsync,
    requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency'
import { Platform } from 'react-native'

// Only import Facebook SDK on native platforms to avoid server-side bundling errors
// react-native-fbsdk-next uses requireNativeComponent which isn't available on server
let AppEventsLogger: typeof import('react-native-fbsdk-next').AppEventsLogger | null = null
let Settings: typeof import('react-native-fbsdk-next').Settings | null = null

// Check if we're in a native environment (not web/server)
const isNative = Platform.OS === 'ios' || Platform.OS === 'android'
const DEBUG_SDK_LOGS = false

if (isNative) {
  try {
    const fbsdk = require('react-native-fbsdk-next')
    AppEventsLogger = fbsdk.AppEventsLogger
    Settings = fbsdk.Settings
  } catch (error) {
    if (__DEV__ && DEBUG_SDK_LOGS) {
      console.log('[FacebookSDK] Failed to load react-native-fbsdk-next:', error)
    }
  }
}

type Params = Record<string, string | number>

export type TrackingPermissionResult = {
  platform: 'ios' | 'android'
  granted: boolean
  promptShown: boolean
  initialStatus: string
  finalStatus: string
  sdkAvailable: boolean
}

/**
 * Initialize Facebook SDK (called early, but NO tracking until ATT consent)
 * Since isAutoInitEnabled=false, we must manually initialize.
 */
export async function initializeFacebookSDK() {
  if (!Settings) {
    if (__DEV__ && DEBUG_SDK_LOGS) console.log('[FacebookSDK] SDK not available')
    return
  }

  try {
    // Initialize the SDK (no events are logged yet due to autoLogAppEventsEnabled=false)
    await Settings!.initializeSDK()

    // On Android, enable tracking immediately (no ATT required)
    if (Platform.OS === 'android') {
      await Settings!.setAdvertiserTrackingEnabled(true)
    }

    if (__DEV__ && DEBUG_SDK_LOGS) {
      console.log(
        '[FacebookSDK] Initialized (tracking disabled until ATT consent)',
      )
    }
  } catch (error) {
    // SDK not available or initialization failed - fail silently
    if (__DEV__ && DEBUG_SDK_LOGS) {
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
export async function requestTrackingPermissionDetailed(): Promise<TrackingPermissionResult> {
  if (Platform.OS !== 'ios') {
    // Android doesn't need ATT - already enabled in initializeFacebookSDK
    return {
      platform: 'android',
      granted: true,
      promptShown: false,
      initialStatus: 'not_applicable',
      finalStatus: 'not_applicable',
      sdkAvailable: Boolean(Settings),
    }
  }

  if (!Settings) {
    if (__DEV__ && DEBUG_SDK_LOGS) console.log('[FacebookSDK] SDK not available for ATT')
    return {
      platform: 'ios',
      granted: false,
      promptShown: false,
      initialStatus: 'sdk_unavailable',
      finalStatus: 'sdk_unavailable',
      sdkAvailable: false,
    }
  }

  try {
    // Check if already determined
    const { status: currentStatus } = await getTrackingPermissionsAsync()

    if (currentStatus === 'granted') {
      // Already granted - enable full tracking
      await Settings!.setAdvertiserTrackingEnabled(true)
      await Settings!.setAdvertiserIDCollectionEnabled(true)
      if (__DEV__ && DEBUG_SDK_LOGS)
        console.log('[FacebookSDK] Tracking already granted, enabled')
      return {
        platform: 'ios',
        granted: true,
        promptShown: false,
        initialStatus: currentStatus,
        finalStatus: currentStatus,
        sdkAvailable: true,
      }
    }

    if (currentStatus === 'denied') {
      // Already denied - respect the decision
      await Settings!.setAdvertiserTrackingEnabled(false)
      if (__DEV__ && DEBUG_SDK_LOGS) console.log('[FacebookSDK] Tracking previously denied')
      return {
        platform: 'ios',
        granted: false,
        promptShown: false,
        initialStatus: currentStatus,
        finalStatus: currentStatus,
        sdkAvailable: true,
      }
    }

    // Status is 'undetermined' - show the ATT popup
    const { status } = await requestTrackingPermissionsAsync()
    const granted = status === 'granted'

    // Enable/disable tracking based on user choice
    await Settings!.setAdvertiserTrackingEnabled(granted)
    if (granted) {
      await Settings!.setAdvertiserIDCollectionEnabled(true)
    }

    if (__DEV__ && DEBUG_SDK_LOGS) {
      console.log(`[FacebookSDK] ATT result: ${status}, tracking: ${granted}`)
    }

    return {
      platform: 'ios',
      granted,
      promptShown: true,
      initialStatus: currentStatus,
      finalStatus: status,
      sdkAvailable: true,
    }
  } catch (error) {
    if (__DEV__ && DEBUG_SDK_LOGS) {
      console.error('[FacebookSDK] ATT request error:', error)
    }
    return {
      platform: 'ios',
      granted: false,
      promptShown: false,
      initialStatus: 'error',
      finalStatus: 'error',
      sdkAvailable: true,
    }
  }
}

export async function requestTrackingPermission(): Promise<boolean> {
  const result = await requestTrackingPermissionDetailed()
  return result.granted
}

/**
 * Log standard Facebook events for ad optimization
 */
export const FacebookEvents = {
  /**
   * Log when user completes registration/signup
   */
  logCompletedRegistration: (registrationMethod?: string) => {
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.logEvent('fb_mobile_complete_registration', {
        fb_registration_method: registrationMethod ?? 'email',
      })
    } catch (error) {
      // SDK not available - fail silently
      if (__DEV__ && DEBUG_SDK_LOGS)
        console.error('[FacebookSDK] logCompletedRegistration error:', error)
    }
  },

  /**
   * Log when user starts a subscription trial
   */
  logStartTrial: (trialType?: string, currency = 'USD', value?: number) => {
    if (!AppEventsLogger) return
    try {
      const eventName = AppEventsLogger!.AppEvents?.StartTrial ?? 'StartTrial'
      const parameters = {
        fb_currency: currency,
        fb_content_type: trialType ?? 'subscription',
      }

      // Send value only when positive; trial start is often a non-monetary event.
      if (typeof value === 'number' && value > 0) {
        AppEventsLogger!.logEvent(eventName, value, parameters)
      } else {
        AppEventsLogger!.logEvent(eventName, parameters)
      }
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] logStartTrial error:', error)
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
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.logPurchase(amount, currency, {
        fb_content_type: subscriptionType ?? 'subscription',
      })
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] logSubscribe error:', error)
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
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.logEvent('fb_mobile_initiated_checkout', amount, {
        fb_currency: currency,
        fb_content_type: contentType ?? 'subscription',
      })
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS)
        console.error('[FacebookSDK] logInitiatedCheckout error:', error)
    }
  },

  /**
   * Log when user completes a workout (custom event for engagement)
   */
  logCompletedWorkout: (workoutData?: Params) => {
    if (!AppEventsLogger) return
    try {
      if (workoutData) {
        AppEventsLogger!.logEvent('CompletedWorkout', workoutData)
      } else {
        AppEventsLogger!.logEvent('CompletedWorkout')
      }
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS)
        console.error('[FacebookSDK] logCompletedWorkout error:', error)
    }
  },

  /**
   * Log when user achieves a level/milestone
   */
  logAchievedLevel: (level: string) => {
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.logEvent('fb_mobile_level_achieved', {
        fb_level: level,
      })
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] logAchievedLevel error:', error)
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
    if (!AppEventsLogger) return
    try {
      const params: Params = { fb_content_type: contentType }
      if (contentId) params.fb_content_id = contentId
      if (contentName) params.fb_content = contentName
      AppEventsLogger!.logEvent('fb_mobile_content_view', params)
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] logViewContent error:', error)
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
    if (!AppEventsLogger) return
    try {
      if (valueToSum !== undefined && parameters) {
        AppEventsLogger!.logEvent(eventName, valueToSum, parameters)
      } else if (valueToSum !== undefined) {
        AppEventsLogger!.logEvent(eventName, valueToSum)
      } else if (parameters) {
        AppEventsLogger!.logEvent(eventName, parameters)
      } else {
        AppEventsLogger!.logEvent(eventName)
      }
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] logCustomEvent error:', error)
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
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.setUserData(userData)
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] setUserData error:', error)
    }
  },

  /**
   * Clear user data (e.g., on logout)
   * Note: SDK doesn't have clearUserData, so we set empty values
   */
  clearUserData: () => {
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.setUserData({})
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] clearUserData error:', error)
    }
  },

  /**
   * Set user ID for cross-platform tracking
   */
  setUserID: (userId: string) => {
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.setUserID(userId)
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] setUserID error:', error)
    }
  },

  /**
   * Clear user ID (e.g., on logout)
   */
  clearUserID: () => {
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.clearUserID()
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] clearUserID error:', error)
    }
  },

  /**
   * Flush events immediately (useful before app goes to background)
   */
  flush: () => {
    if (!AppEventsLogger) return
    try {
      AppEventsLogger!.flush()
    } catch (error) {
      if (__DEV__ && DEBUG_SDK_LOGS) console.error('[FacebookSDK] flush error:', error)
    }
  },
}
