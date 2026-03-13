import { useAuth } from '@/contexts/auth-context'
import { database } from '@/lib/database'
import type { Profile } from '@/types/database.types'
import { supabase } from '@/lib/supabase'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { usePathname, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Alert, Platform } from 'react-native'

const WORKOUT_PUSH_PROMPT_FIRST_MILESTONE = 3
const WORKOUT_PUSH_PROMPT_REPEAT_INTERVAL = 5

let isPushPromptVisible = false

/**
 * Hook to handle notification responses
 * Does NOT automatically register for push notifications - call registerForPushNotifications separately
 */
export function usePushNotifications() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const notificationListener = useRef<Notifications.Subscription | undefined>(
    undefined,
  )
  const responseListener = useRef<Notifications.Subscription | undefined>(
    undefined,
  )
  const lastPathnameRef = useRef(pathname || '/(tabs)')

  useEffect(() => {
    lastPathnameRef.current = pathname || '/(tabs)'
  }, [pathname])

  useEffect(() => {
    if (!user) return

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // You could show an in-app toast here
      },
    )

    // Listen for user tapping on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { workoutId, notificationId, type, route } = response.notification
          .request.content.data as {
          workoutId?: string
          notificationId?: string
          type?: string
          route?: string
        }

        // Mark notification as read
        if (notificationId) {
          database.notifications.markAsRead(notificationId).catch((error) => {
            console.error('[Push] Error marking notification as read:', error)
          })
        }

        if (typeof route === 'string' && route.length > 0) {
          router.push(route as any)
          return
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
        } else if (
          (type === 'workout_comment' ||
            type === 'workout_comment_reply' ||
            type === 'workout_comment_like') &&
          workoutId
        ) {
          router.push({
            pathname: '/workout-comments/[workoutId]',
            params: {
              workoutId,
              returnTo: lastPathnameRef.current,
            },
          } as any)
        } else if (type === 'workout_like' && workoutId) {
          router.push(buildWorkoutHref(workoutId) as any)
        } else if (type === 'trial_reminder') {
          router.push('/(tabs)/profile')
        } else if (
          type === 'retention_scheduled_workout' ||
          type === 'retention_streak_protection' ||
          type === 'retention_inactivity'
        ) {
          router.push('/(tabs)/create-post')
        } else if (
          type === 'retention_weekly_recap' ||
          type === 'retention_milestone'
        ) {
          router.push('/(tabs)/profile')
        } else if (workoutId) {
          // Fallback to workout detail for any other workout-related notifications
          router.push(buildWorkoutHref(workoutId) as any)
        }
      },
    )

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

type PushNotificationPromptOptions = {
  userId: string
  title?: string
  message?: string
}

const markPushPromptRequested = async (userId: string) => {
  try {
    await database.profiles.update(userId, {
      has_requested_push_notifications: true,
    })
  } catch (error) {
    console.error('[Push] Failed to mark notification prompt as requested:', error)
  }
}

export function shouldPromptForPushNotificationsAfterWorkout(
  profile: Pick<Profile, 'expo_push_token'>,
  workoutCount: number,
) {
  if (profile.expo_push_token) {
    return false
  }

  if (workoutCount < WORKOUT_PUSH_PROMPT_FIRST_MILESTONE) {
    return false
  }

  return (
    workoutCount === WORKOUT_PUSH_PROMPT_FIRST_MILESTONE ||
    (workoutCount - WORKOUT_PUSH_PROMPT_FIRST_MILESTONE) %
      WORKOUT_PUSH_PROMPT_REPEAT_INTERVAL ===
      0
  )
}

export async function promptForPushNotifications({
  userId,
  title = 'Get the best experience',
  message = 'Enable notifications to get workout reactions, comments, reminders, and important updates.',
}: PushNotificationPromptOptions) {
  try {
    const profile = await database.profiles.getByIdOrNull(userId)
    if (profile?.expo_push_token) {
      return
    }
  } catch (error) {
    console.error('[Push] Failed to check notification prompt eligibility:', error)
  }

  if (isPushPromptVisible) {
    return
  }

  isPushPromptVisible = true

  const finishPrompt = () => {
    isPushPromptVisible = false
  }

  Alert.alert(title, message, [
    {
      text: 'Not Now',
      style: 'cancel',
      onPress: () => {
        finishPrompt()
        void markPushPromptRequested(userId)
      },
    },
    {
      text: 'Enable',
      onPress: () => {
        finishPrompt()
        void (async () => {
          try {
            await registerForPushNotifications()
          } finally {
            await markPushPromptRequested(userId)
          }
        })()
      },
    },
  ])
}

export function schedulePushNotificationPrompt(
  options: PushNotificationPromptOptions & { delayMs?: number },
) {
  const { delayMs = 0, ...promptOptions } = options

  if (delayMs <= 0) {
    void promptForPushNotifications(promptOptions)
    return
  }

  setTimeout(() => {
    void promptForPushNotifications(promptOptions)
  }, delayMs)
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
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
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
      const channelConfigs: Record<string, Notifications.NotificationChannelInput> =
        {
          default: {
            name: 'General',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
          },
          social: {
            name: 'Social Activity',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
          },
          retention_scheduled: {
            name: 'Workout Reminders',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
          },
          retention_streak: {
            name: 'Streak Protection',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
          },
          retention_inactivity: {
            name: 'Comeback Nudges',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
          },
          retention_weekly: {
            name: 'Weekly Recaps',
            importance: Notifications.AndroidImportance.LOW,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
          },
          retention_milestone: {
            name: 'Milestones',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
            sound: 'default',
          },
        }

      await Promise.all(
        Object.entries(channelConfigs).map(([channelId, config]) =>
          Notifications.setNotificationChannelAsync(channelId, config),
        ),
      )
    }
  } catch (error) {
    console.error('[Push] Registration error:', error)
  }
}
