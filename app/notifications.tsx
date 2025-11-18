import { SlideInView } from '@/components/slide-in-view'
import { useNotifications } from '@/contexts/notification-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
  formatNotificationText,
  getNotificationIcon,
  getNotificationIconColor,
} from '@/lib/utils/notification-formatters'
import type { NotificationWithProfiles } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { router, usePathname } from 'expo-router'
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
  const pathname = usePathname()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsReadOptimistically,
    refreshNotifications,
  } = useNotifications()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [respondingRequests, setRespondingRequests] = useState<Set<string>>(
    new Set(),
  )
  const [respondedRequests, setRespondedRequests] = useState<
    Map<string, 'approve' | 'decline'>
  >(new Map())
  const [shouldExit, setShouldExit] = useState(false)
  const [shouldAnimate] = useState(true)

  // Reset responded requests state when screen is focused
  // The database filtering will handle not showing already-responded requests
  useFocusEffect(
    useCallback(() => {
      setRespondedRequests(new Map())
    }, []),
  )

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
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

  const handleNotificationPress = useCallback(
    async (notification: NotificationWithProfiles) => {
      try {
        await database.notifications.markAsRead(notification.id)
        await refreshNotifications()

        if (
          notification.type === 'follow_request_received' ||
          notification.type === 'follow_request_approved' ||
          notification.type === 'follow_request_declined'
        ) {
          router.push('/follow-requests')
        } else if (notification.type === 'workout_comment') {
          // Navigate to the comments view for the workout
          router.push(`/workout-comments/${notification.workout_id}`)
        } else if (
          notification.type === 'workout_like' &&
          notification.workout_id
        ) {
          // Navigate to the workout detail view for likes
          router.push({
            pathname: '/workout/[workoutId]',
            params: {
              workoutId: notification.workout_id,
              returnTo: pathname,
            },
          })
        } else {
          // For other notifications, go to the feed
          router.push('/(tabs)')
        }
      } catch (error) {
        console.error('Error handling notification press:', error)
      }
    },
    [refreshNotifications, pathname],
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

  const handleFollowRequestResponse = useCallback(
    async (requestId: string, decision: 'approve' | 'decline') => {
      try {
        setRespondingRequests((prev) => new Set(prev).add(requestId))
        await database.followRequests.respond(requestId, decision)
        // Mark this request as responded to and store the decision
        setRespondedRequests((prev) => new Map(prev).set(requestId, decision))

        // Optimistically remove the notification from the list after a short delay
        // This gives users time to see the updated message before it disappears
        setTimeout(() => {
          refreshNotifications()
        }, 1500)
      } catch (error) {
        console.error('Error responding to follow request notification:', error)
        Alert.alert(
          'Error',
          'Unable to update that follow request. Please try again.',
        )
      } finally {
        setRespondingRequests((prev) => {
          const next = new Set(prev)
          next.delete(requestId)
          return next
        })
      }
    },
    [refreshNotifications],
  )

  return (
    <SlideInView
      style={{ flex: 1 }}
      enabled={shouldAnimate}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
          <TouchableOpacity
            onPress={handleBackPress}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              style={styles.markAllButton}
            >
              <Text style={styles.markAllReadText}>Mark all</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          {notifications.length > 0 ? (
            <View style={styles.notificationsList}>
              {notifications.map((notification) => {
                const actorNames = notification.actorProfiles.map(
                  (p) => p.display_name,
                )
                const actorCount = notification.actors.length
                let { title, body } = formatNotificationText(
                  notification.type,
                  actorNames,
                  actorCount,
                )

                // Update messaging if this request was responded to
                if (
                  notification.type === 'follow_request_received' &&
                  notification.request_id &&
                  respondedRequests.has(notification.request_id)
                ) {
                  const decision = respondedRequests.get(
                    notification.request_id,
                  )
                  const firstActor = actorNames[0] || 'User'

                  if (decision === 'approve') {
                    title = 'Request Approved'
                    body = `${firstActor} is now following you`
                  } else if (decision === 'decline') {
                    title = 'Request Declined'
                    body = `You declined ${firstActor}'s follow request`
                  }
                }

                let iconName = getNotificationIcon(notification.type)
                let iconColor = getNotificationIconColor(
                  notification.read,
                  colors.primary,
                  colors.textSecondary,
                )

                // Update icon if this request was responded to
                if (
                  notification.type === 'follow_request_received' &&
                  notification.request_id &&
                  respondedRequests.has(notification.request_id)
                ) {
                  const decision = respondedRequests.get(
                    notification.request_id,
                  )
                  if (decision === 'approve') {
                    iconName = 'checkmark-circle'
                    iconColor = colors.success || colors.primary
                  } else if (decision === 'decline') {
                    iconName = 'close-circle'
                    iconColor = colors.textSecondary
                  }
                }

                const showFollowRequestActions =
                  notification.type === 'follow_request_received' &&
                  Boolean(notification.request_id) &&
                  !respondedRequests.has(notification.request_id!)
                const isResponding =
                  notification.request_id &&
                  respondingRequests.has(notification.request_id)

                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      !notification.read && styles.notificationItemUnread,
                    ]}
                    onPress={() => handleNotificationPress(notification)}
                    activeOpacity={0.7}
                  >
                    {/* Actor avatars (show first 2) */}
                    <View style={styles.avatarsContainer}>
                      {notification.actorProfiles
                        .slice(0, 2)
                        .map((actor, index) => (
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
                              <View
                                style={[
                                  styles.avatar,
                                  styles.avatarPlaceholder,
                                ]}
                              >
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
                            !notification.read &&
                              styles.notificationTitleUnread,
                          ]}
                        >
                          {title}
                        </Text>
                      </View>
                      <Text style={styles.notificationBody}>{body}</Text>
                      {showFollowRequestActions && notification.request_id && (
                        <View style={styles.followRequestActions}>
                          <TouchableOpacity
                            style={[
                              styles.followRequestButton,
                              styles.declineButton,
                            ]}
                            onPress={() =>
                              handleFollowRequestResponse(
                                notification.request_id!,
                                'decline',
                              )
                            }
                            disabled={isResponding}
                          >
                            {isResponding ? (
                              <ActivityIndicator
                                size="small"
                                color={colors.error}
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.followRequestButtonText,
                                  styles.declineButtonText,
                                ]}
                              >
                                Decline
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.followRequestButton,
                              styles.approveButton,
                            ]}
                            onPress={() =>
                              handleFollowRequestResponse(
                                notification.request_id!,
                                'approve',
                              )
                            }
                            disabled={isResponding}
                          >
                            {isResponding ? (
                              <ActivityIndicator
                                size="small"
                                color={colors.white}
                              />
                            ) : (
                              <Text style={styles.followRequestButtonText}>
                                Approve
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
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
                You&apos;ll be notified when someone likes or comments on your
                workouts
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SlideInView>
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
      backgroundColor: colors.white,
    },
    header: {
      position: 'relative',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    backButton: {
      position: 'absolute',
      left: 20,
      top: 16,
      padding: 4,
    },
    markAllButton: {
      position: 'absolute',
      right: 20,
      top: 16,
    },
    markAllReadText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
    },
    notificationsList: {
      flex: 1,
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
    followRequestActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    followRequestButton: {
      flex: 1,
      borderRadius: 20,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    followRequestButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.white,
    },
    approveButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    declineButton: {
      backgroundColor: colors.white,
      borderColor: colors.border,
    },
    declineButtonText: {
      color: colors.error,
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
