import React, { createContext, useContext, useEffect, useState } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

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
  markAsRead: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
)

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [hasPermission, setHasPermission] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Request notification permissions on mount
  useEffect(() => {
    checkPermission()
  }, [])

  // Listen for incoming notifications
  useEffect(() => {
    if (!isNotificationsAvailable) return

    try {
      // Listener for when notification is received while app is foregrounded
      const notificationListener =
        Notifications.addNotificationReceivedListener((notification) => {
          console.log('[Notifications] Received:', notification)
          setUnreadCount((prev) => prev + 1)
        })

      // Listener for when user taps on notification
      const responseListener =
        Notifications.addNotificationResponseReceivedListener((response) => {
          console.log('[Notifications] User tapped notification:', response)
          // Navigation will be handled in the notifications screen
        })

      return () => {
        notificationListener.remove()
        responseListener.remove()
      }
    } catch (error) {
      console.warn('[Notifications] Failed to set up listeners:', error)
    }
  }, [])

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
          lightColor: '#FF231F7C',
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

  const markAsRead = () => {
    setUnreadCount(0)
  }

  return (
    <NotificationContext.Provider
      value={{
        hasPermission,
        requestPermission,
        unreadCount,
        markAsRead,
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
