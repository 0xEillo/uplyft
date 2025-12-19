import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import type { NotificationWithProfiles } from '@/types/database.types'
import * as Notifications from 'expo-notifications'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useAuth } from './auth-context'

// Check if notifications module is available (requires native build)
let isNotificationsAvailable = true
try {
  // Configure how notifications are handled when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
} catch (error) {
  console.warn('[Notifications] Native module not available. Please rebuild the app.')
  isNotificationsAvailable = false
}

interface NotificationContextType {
  hasPermission: boolean
  requestPermission: () => Promise<boolean>
  unreadCount: number
  notifications: NotificationWithProfiles[]
  markAsRead: () => void
  markAllAsReadOptimistically: () => void
  refreshNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
)

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const [hasPermission, setHasPermission] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationWithProfiles[]>([])

  // Load notifications from database
  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    try {
      const data = await database.notifications.list(user.id)
      setNotifications(data)

      const unread = data.filter((n) => !n.read).length
      setUnreadCount(unread)
    } catch (error: any) {
      // Silently handle transient server errors (like 502 Bad Gateway) 
      // instead of printing full HTML blobs to the console.
      const errorMessage = error?.message || String(error)
      if (!errorMessage.includes('502') && !errorMessage.includes('<html>')) {
        console.error('[Notifications] Error loading notifications:', errorMessage)
      }
      
      // Fallback: keep existing notifications but don't crash
    }
  }, [user])

  // Request notification permissions on mount
  useEffect(() => {
    checkPermission()
  }, [])

  // Load notifications when user changes
  useEffect(() => {
    if (user) {
      loadNotifications()
    }
  }, [user, loadNotifications])

  // Real-time subscription to notifications table
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, loadNotifications])

  // Listen for incoming push notifications
  useEffect(() => {
    if (!isNotificationsAvailable) return

    try {
      // Listener for when notification is received while app is foregrounded
      const notificationListener =
        Notifications.addNotificationReceivedListener((notification) => {
          // Reload from database to get updated count
          loadNotifications()
        })

      // Listener for when user taps on notification
      const responseListener =
        Notifications.addNotificationResponseReceivedListener(() => {
          // Navigation is handled in usePushNotifications hook
          // Just reload notifications here
          loadNotifications()
        })

      return () => {
        notificationListener.remove()
        responseListener.remove()
      }
    } catch (error) {
      console.warn('[Notifications] Failed to set up listeners:', error)
    }
  }, [loadNotifications])

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
          lightColor: '#FF6B35', // App primary color
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
    setUnreadCount(0)
  }, [])

  const markAllAsReadOptimistically = useCallback(() => {
    // Optimistically update UI immediately
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) => ({
        ...notification,
        read: true,
      }))
    )
    setUnreadCount(0)
  }, [])

  const refreshNotifications = useCallback(async () => {
    await loadNotifications()
  }, [loadNotifications])

  return (
    <NotificationContext.Provider
      value={{
        hasPermission,
        requestPermission,
        unreadCount,
        notifications,
        markAsRead,
        markAllAsReadOptimistically,
        refreshNotifications,
      }}
    >
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
