import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'expo-router'
import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'

/**
 * Hook to handle notification responses
 * Does NOT automatically register for push notifications - call registerForPushNotifications separately
 */
export function usePushNotifications() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined)
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined)
  const lastPathnameRef = useRef(pathname || '/(tabs)')

  useEffect(() => {
    lastPathnameRef.current = pathname || '/(tabs)'
  }, [pathname])

  useEffect(() => {
    if (!user) return

    // Listen for notifications received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification) => {
        // You could show an in-app toast here
      })

    // Listen for user tapping on notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const { workoutId, notificationId, type, requestId } =
          response.notification.request.content.data as {
            workoutId?: string
            notificationId?: string
            type?: string
            requestId?: string
          }

        // Mark notification as read
        if (notificationId) {
          database.notifications.markAsRead(notificationId).catch((error) => {
            console.error('[Push] Error marking notification as read:', error)
          })
        }

        // Navigate based on notification type
        const buildWorkoutHref = (id: string) => ({
          pathname: '/workout/[workoutId]' as const,
          params: {
            workoutId: id,
            returnTo: lastPathnameRef.current,
          },
        })

        if (
          type === 'follow_request_received' ||
          type === 'follow_request_approved' ||
          type === 'follow_request_declined' ||
          type === 'follow_received'
        ) {
          router.push('/follow-requests')
        } else if (type === 'workout_comment' && workoutId) {
          router.push(`/workout-comments/${workoutId}` as any)
        } else if (type === 'workout_like' && workoutId) {
          router.push(buildWorkoutHref(workoutId) as any)
        } else if (workoutId) {
          // Fallback to workout detail for any other workout-related notifications
          router.push(buildWorkoutHref(workoutId) as any)
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
export async function registerForPushNotifications() {
  // Only run on physical devices
  if (!Device.isDevice) {
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
      return
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) {
      console.error('[Push] No EAS project ID found in config')
      return
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    } as any)
    const token = tokenData.data

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return
    }

    // Store token in database
    await database.profiles.update(user.id, { expo_push_token: token })

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
