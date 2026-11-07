import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import type { NotificationWithProfiles } from '@/types/database.types'
import * as Notifications from 'expo-notifications'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform } from 'react-native'
import { useAuth } from './auth-context'

// Check if notifications module is available (requires native build)
let isNotificationsAvailable = true
try {
  // Configure how notifications are handled when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isRestTimerNotification =
        notification.request.content.data?.type === 'rest_timer'

      return {
        shouldShowAlert: !isRestTimerNotification,
        shouldPlaySound: !isRestTimerNotification,
        shouldSetBadge: !isRestTimerNotification,
        shouldShowBanner: !isRestTimerNotification,
        shouldShowList: !isRestTimerNotification,
      }
    },
  })
} catch {
  console.warn('[Notifications] Native module not available. Please rebuild the app.')
  isNotificationsAvailable = false
}

const syncApplicationBadge = async (count: number) => {
  if (!isNotificationsAvailable) return

  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count))
  } catch (error) {
    console.warn('[Notifications] Failed to sync app badge:', error)
  }
}

interface NotificationContextType {
  hasPermission: boolean
  requestPermission: () => Promise<boolean>
  unreadCount: number
  notifications: NotificationWithProfiles[]
  /** True once the first load for the current user has finished. */
  hasLoaded: boolean
  /** Mark every notification as read (optimistic, syncs in background). */
  markAsRead: () => void
  /** Mark a single notification as read (optimistic, syncs in background). */
  markNotificationAsRead: (notificationId: string) => void
  refreshNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
)

// Coalesce bursts of realtime events (e.g. "mark all as read" fires one
// UPDATE event per row) into a single reload.
const REALTIME_RELOAD_DEBOUNCE_MS = 400

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [hasPermission, setHasPermission] = useState(false)
  const [notifications, setNotifications] = useState<NotificationWithProfiles[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const loadSeqRef = useRef(0)
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notificationsRef = useRef(notifications)
  notificationsRef.current = notifications

  const unreadCount = useMemo(
    () => notifications.reduce((count, n) => (n.read ? count : count + 1), 0),
    [notifications]
  )

  // Load notifications from database
  const loadNotifications = useCallback(async () => {
    const seq = ++loadSeqRef.current

    if (!userId) {
      setNotifications([])
      setHasLoaded(false)
      return
    }

    try {
      const data = await database.notifications.list(userId)
      // Ignore stale responses so an older request can't overwrite newer data
      if (seq !== loadSeqRef.current) return
      setNotifications(data)
    } catch (error: unknown) {
      // Silently handle transient server errors (like 502 Bad Gateway)
      // instead of printing full HTML blobs to the console.
      const errorMessage = (error as { message?: string })?.message || String(error)
      if (!errorMessage.includes('502') && !errorMessage.includes('<html>')) {
        console.error('[Notifications] Error loading notifications:', errorMessage)
      }
      // Fallback: keep existing notifications but don't crash
    } finally {
      if (seq === loadSeqRef.current) setHasLoaded(true)
    }
  }, [userId])

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null
      void loadNotifications()
    }, REALTIME_RELOAD_DEBOUNCE_MS)
  }, [loadNotifications])

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    }
  }, [])

  // Request notification permissions on mount
  useEffect(() => {
    checkPermission()
  }, [])

  // Load notifications when the signed-in user changes
  useEffect(() => {
    setHasLoaded(false)
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    void syncApplicationBadge(unreadCount)
  }, [unreadCount])

  // Real-time subscription to notifications table
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          scheduleReload()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, scheduleReload])

  // Listen for incoming push notifications
  useEffect(() => {
    if (!isNotificationsAvailable) return

    try {
      // Listener for when notification is received while app is foregrounded
      const notificationListener =
        Notifications.addNotificationReceivedListener(() => {
          scheduleReload()
        })

      // Listener for when user taps on notification
      const responseListener =
        Notifications.addNotificationResponseReceivedListener(() => {
          // Navigation is handled in usePushNotifications hook
          scheduleReload()
        })

      return () => {
        notificationListener.remove()
        responseListener.remove()
      }
    } catch (error) {
      console.warn('[Notifications] Failed to set up listeners:', error)
    }
  }, [scheduleReload])

  const checkPermission = async () => {
    if (!isNotificationsAvailable) {
      setHasPermission(false)
      return
    }

    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync()
      setHasPermission(existingStatus === 'granted')
    } catch (error) {
      console.warn('[Notifications] Failed to check permission:', error)
      setHasPermission(false)
    }
  }

  const requestPermission = async (): Promise<boolean> => {
    if (!isNotificationsAvailable) {
      console.warn('[Notifications] Native module not available')
      return false
    }

    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync()

      let finalStatus = existingStatus

      // If not granted, request permission
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      // For Android 13+, we need to request POST_NOTIFICATIONS permission
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          enableLights: true,
          lightColor: '#FF6B35', // App primary color
          sound: 'default',
        })
      }

      const granted = finalStatus === 'granted'
      setHasPermission(granted)
      return granted
    } catch (error) {
      console.error('[Notifications] Permission request error:', error)
      return false
    }
  }

  const markAsRead = useCallback(() => {
    if (!notificationsRef.current.some((n) => !n.read)) return

    // Drop any in-flight load so it can't overwrite the optimistic update
    loadSeqRef.current++
    setNotifications((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true }))
    )

    if (!userId) return

    database.notifications.markAllAsRead(userId).catch((error) => {
      console.error('[Notifications] Error marking notifications as read:', error)
      void loadNotifications()
    })
  }, [loadNotifications, userId])

  const markNotificationAsRead = useCallback(
    (notificationId: string) => {
      const target = notificationsRef.current.find((n) => n.id === notificationId)
      if (!target || target.read) return

      loadSeqRef.current++
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )

      database.notifications.markAsRead(notificationId).catch((error) => {
        console.error('[Notifications] Error marking notification as read:', error)
        void loadNotifications()
      })
    },
    [loadNotifications]
  )

  const value = useMemo<NotificationContextType>(
    () => ({
      hasPermission,
      requestPermission,
      unreadCount,
      notifications,
      hasLoaded,
      markAsRead,
      markNotificationAsRead,
      refreshNotifications: loadNotifications,
    }),
    // requestPermission only closes over stable setters
    [
      hasPermission,
      unreadCount,
      notifications,
      hasLoaded,
      markAsRead,
      markNotificationAsRead,
      loadNotifications,
    ]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    )
  }
  return context
}
