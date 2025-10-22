import { useNotifications } from '@/contexts/notification-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type NotificationItem = {
  id: string
  title: string
  body: string
  date: Date
  data?: any
  read: boolean
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  return date.toLocaleDateString()
}

function mapExpoNotificationToItem(
  notification: Notifications.Notification,
): NotificationItem {
  const identifier =
    notification.request.identifier ||
    `${notification.request.content.title ?? 'notification'}-${
      notification.date ?? Date.now()
    }`

  return {
    id: identifier,
    title: notification.request.content.title || 'Notification',
    body: notification.request.content.body || '',
    date: normalizeNotificationDate(notification.date),
    data: notification.request.content.data,
    read: false,
  }
}

function normalizeNotificationDate(date: number | Date | undefined): Date {
  if (!date) {
    return new Date()
  }

  if (date instanceof Date) {
    return date
  }

  return new Date(date)
}

export default function NotificationsScreen() {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { unreadCount, markAsRead } = useNotifications()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])


  // Listen for received notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const newNotification = mapExpoNotificationToItem(notification)
        setNotifications((prev) => {
          if (prev.some((existing) => existing.id === newNotification.id)) {
            return prev
          }

          return [newNotification, ...prev]
        })
      },
    )

    return () => subscription.remove()
  }, [])

  // Listen for notification responses (when user taps notification)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const notificationId = response.notification.request.identifier

        // Mark as read
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
        )
      },
    )

    return () => subscription.remove()
  }, [])

  // Mark notifications as read when screen is viewed
  useEffect(() => {
    if (unreadCount > 0) {
      markAsRead()
    }
  }, [unreadCount, markAsRead])

  const handleBackPress = () => {
    router.back()
  }

  const handleNotificationPress = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    )

    Notifications.dismissNotificationAsync(notificationId).catch((error) => {
      console.warn(
        '[NotificationsScreen] Failed to dismiss notification:',
        error,
      )
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length > 0 ? (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={styles.notificationItem}
                onPress={() => handleNotificationPress(notification.id)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons
                    name={
                      notification.read
                        ? 'notifications-outline'
                        : 'notifications'
                    }
                    size={24}
                    color={
                      notification.read ? colors.textSecondary : colors.primary
                    }
                  />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationBody}>
                    {notification.body}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {formatTimeAgo(notification.date)}
                  </Text>
                </View>
                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="notifications-outline"
                size={80}
                color={colors.border}
              />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyMessage}>
              We&apos;ll notify you when your trial is about to end
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function createStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    placeholder: {
      width: 24,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
    },
    notificationsList: {
      flex: 1,
      paddingTop: 8,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    notificationIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    notificationBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    notificationTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: 8,
      marginTop: 6,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
  })
}
