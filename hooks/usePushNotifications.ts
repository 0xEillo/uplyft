import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'

/**
 * Hook to register for push notifications and handle notification responses
 * Automatically registers the device when user is authenticated
 */
export function usePushNotifications() {
  const { user } = useAuth()
  const router = useRouter()
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    if (!user) return

    // Register for push notifications on mount
    registerForPushNotifications()

    // Listen for notifications received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('[Push] Notification received:', notification)
        // You could show an in-app toast here
      })

    // Listen for user tapping on notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const { workoutId, notificationId } =
          response.notification.request.content.data as {
            workoutId?: string
            notificationId?: string
          }

        console.log('[Push] Notification tapped:', { workoutId, notificationId })

        // Mark notification as read
        if (notificationId) {
          database.notifications.markAsRead(notificationId).catch((error) => {
            console.error('[Push] Error marking notification as read:', error)
          })
        }

        // Navigate to workout detail screen
        if (workoutId) {
          router.push(`/(tabs)`) // Navigate to feed first
          // The workout will be visible in the feed
          // Future: could add a workout detail screen
        }
      })

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove()
      }
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [user, router])
}

/**
 * Register device for push notifications and store token in Supabase
 */
async function registerForPushNotifications() {
  // Only run on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Skipping registration - not a physical device')
    return
  }

  try {
    // Check existing permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted')
      return
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) {
      console.error('[Push] No EAS project ID found in config')
      return
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
    const token = tokenData.data

    console.log('[Push] Token obtained:', token)

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.log('[Push] No authenticated user, skipping token storage')
      return
    }

    // Store token in database
    await database.profiles.update(user.id, { expo_push_token: token })
    console.log('[Push] Token saved to database')

    // iOS: reset badge count
    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(0)
    }

    // Android: set notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35', // App primary color
        sound: 'default',
      })
    }
  } catch (error) {
    console.error('[Push] Registration error:', error)
  }
}
