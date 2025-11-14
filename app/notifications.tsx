import { useNotifications } from '@/contexts/notification-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
  formatNotificationText,
  getNotificationIcon,
  getNotificationIconColor,
} from '@/lib/utils/notification-formatters'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotificationsScreen() {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsReadOptimistically,
    refreshNotifications,
  } = useNotifications()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshNotifications()
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshNotifications])

  const handleBackPress = () => {
    // Mark all as read when leaving notifications screen
    if (unreadCount > 0) {
      markAsRead()
    }
    router.back()
  }

  const handleNotificationPress = useCallback(
    async (notificationId: string, workoutId: string) => {
      try {
        // Mark as read
        await database.notifications.markAsRead(notificationId)
        // Refresh to update UI
        await refreshNotifications()
        // Navigate to feed (workout will be visible there)
        router.push('/(tabs)')
      } catch (error) {
        console.error('Error handling notification press:', error)
      }
    },
    [refreshNotifications]
  )

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      // Optimistically update UI immediately
      markAllAsReadOptimistically()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Update database in background
      await database.notifications.markAllAsRead(user.id)

      // Refresh to ensure sync with database
      await refreshNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
      Alert.alert('Error', 'Failed to mark notifications as read')
      // Refresh to revert optimistic update if it failed
      await refreshNotifications()
    }
  }, [markAllAsReadOptimistically, refreshNotifications])

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
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllReadText}>Mark all</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {notifications.length > 0 ? (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => {
              const actorNames = notification.actorProfiles.map(
                (p) => p.display_name
              )
              const actorCount = notification.actors.length
              const { title, body } = formatNotificationText(
                notification.type,
                actorNames,
                actorCount
              )

              const iconName = getNotificationIcon(notification.type)
              const iconColor = getNotificationIconColor(
                notification.read,
                colors.primary,
                colors.textSecondary
              )

              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.read && styles.notificationItemUnread,
                  ]}
                  onPress={() =>
                    handleNotificationPress(
                      notification.id,
                      notification.workout_id
                    )
                  }
                  activeOpacity={0.7}
                >
                  {/* Actor avatars (show first 3) */}
                  <View style={styles.avatarsContainer}>
                    {notification.actorProfiles.slice(0, 3).map((actor, index) => (
                      <View
                        key={actor.id}
                        style={[
                          styles.avatarWrapper,
                          index > 0 && { marginLeft: -8 },
                        ]}
                      >
                        {actor.avatar_url ? (
                          <Image
                            source={{ uri: actor.avatar_url }}
                            style={styles.avatar}
                          />
                        ) : (
                          <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>
                              {actor.display_name[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Notification content */}
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Ionicons
                        name={iconName as any}
                        size={16}
                        color={iconColor}
                        style={styles.notificationTypeIcon}
                      />
                      <Text
                        style={[
                          styles.notificationTitle,
                          !notification.read && styles.notificationTitleUnread,
                        ]}
                      >
                        {title}
                      </Text>
                    </View>
                    <Text style={styles.notificationBody}>{body}</Text>
                    <Text style={styles.notificationTime}>
                      {formatTimeAgo(notification.updated_at)}
                    </Text>
                  </View>

                  {/* Unread indicator */}
                  {!notification.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              )
            })}
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
              You'll be notified when someone likes or comments on your workouts
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
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
    markAllReadText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    placeholder: {
      width: 60,
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
    notificationItemUnread: {
      backgroundColor: colors.backgroundLight,
    },
    avatarsContainer: {
      flexDirection: 'row',
      marginRight: 12,
      marginTop: 2,
    },
    avatarWrapper: {
      borderWidth: 2,
      borderColor: colors.white,
      borderRadius: 16,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.white,
    },
    notificationContent: {
      flex: 1,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    notificationTypeIcon: {
      marginRight: 6,
    },
    notificationTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    notificationTitleUnread: {
      color: colors.text,
    },
    notificationBody: {
      fontSize: 14,
      color: colors.text,
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
