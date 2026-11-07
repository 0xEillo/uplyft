import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { EmptyState } from '@/components/EmptyState'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { Layout } from '@/constants/theme'
import { useAnalytics } from '@/contexts/analytics-context'
import { useNotifications } from '@/contexts/notification-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import {
  formatNotificationText,
  getNotificationIcon,
  getNotificationIconColor,
} from '@/lib/utils/notification-formatters'
import { resolveNotificationRoute } from '@/lib/utils/notification-routing'
import type { NotificationWithProfiles } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type FollowRequestDecision = 'approve' | 'decline'
type Styles = ReturnType<typeof createStyles>
type Colors = ReturnType<typeof useThemedColors>

// How long to show the "Request approved/declined" state before the row is
// dropped from the list.
const RESPONDED_REQUEST_DISMISS_MS = 1500

export default function NotificationsScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const { trackEvent } = useAnalytics()
  const {
    notifications,
    unreadCount,
    hasLoaded,
    markAsRead,
    markNotificationAsRead,
    refreshNotifications,
  } = useNotifications()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [respondingRequests, setRespondingRequests] = useState<Set<string>>(
    () => new Set(),
  )
  const [respondedRequests, setRespondedRequests] = useState<
    Map<string, FollowRequestDecision>
  >(() => new Map())

  const topInset = insets.top + Layout.navbarHeight

  // Keep latest values in refs so focus/unmount effects don't re-fire on
  // every data change.
  const statsRef = useRef({ count: notifications.length, unread: unreadCount })
  statsRef.current = { count: notifications.length, unread: unreadCount }
  const markAsReadRef = useRef(markAsRead)
  markAsReadRef.current = markAsRead
  const dismissTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useFocusEffect(
    useCallback(() => {
      trackEvent(AnalyticsEvents.NOTIFICATIONS_VIEWED, {
        notification_count: statsRef.current.count,
        unread_count: statsRef.current.unread,
      })
    }, [trackEvent]),
  )

  // Pull fresh data in the background; cached data renders immediately.
  useEffect(() => {
    void refreshNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mark everything as read when the screen is left by any route
  // (back button, swipe gesture, Android back).
  useEffect(() => {
    const timers = dismissTimersRef.current
    return () => {
      timers.forEach(clearTimeout)
      markAsReadRef.current()
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshNotifications()
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshNotifications])

  const handleBackPress = useCallback(() => {
    router.back()
  }, [])

  const handleNotificationPress = useCallback(
    (notification: NotificationWithProfiles) => {
      trackEvent(AnalyticsEvents.NOTIFICATION_TAPPED, {
        notification_id: notification.id,
        notification_type: notification.type,
      })

      // Navigate immediately; read state syncs in the background.
      markNotificationAsRead(notification.id)
      router.push(
        resolveNotificationRoute(notification, {
          returnTo: '/notifications',
        }) as any,
      )
    },
    [markNotificationAsRead, trackEvent],
  )

  const handleFollowRequestResponse = useCallback(
    async (requestId: string, decision: FollowRequestDecision) => {
      setRespondingRequests((prev) => new Set(prev).add(requestId))
      try {
        await database.followRequests.respond(requestId, decision)
        setRespondedRequests((prev) => new Map(prev).set(requestId, decision))

        // Give the user a moment to see the result before the row disappears
        dismissTimersRef.current.push(
          setTimeout(() => {
            void refreshNotifications()
          }, RESPONDED_REQUEST_DISMISS_MS),
        )
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

  const renderItem = useCallback<ListRenderItem<NotificationWithProfiles>>(
    ({ item }) => {
      const requestId = item.request_id
      return (
        <NotificationRow
          notification={item}
          decision={requestId ? respondedRequests.get(requestId) : undefined}
          isResponding={requestId ? respondingRequests.has(requestId) : false}
          onPress={handleNotificationPress}
          onRespond={handleFollowRequestResponse}
          colors={colors}
          styles={styles}
        />
      )
    },
    [
      respondedRequests,
      respondingRequests,
      handleNotificationPress,
      handleFollowRequestResponse,
      colors,
      styles,
    ],
  )

  const listEmpty = hasLoaded ? (
    <EmptyState
      icon="notifications-outline"
      title="No notifications yet"
      description="When people follow you or interact with your workouts, you'll see them here."
    />
  ) : (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  )

  return (
    <View style={styles.container}>
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity
                onPress={handleBackPress}
                accessibilityLabel="Go back"
                accessibilityRole="button"
                style={styles.backButton}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={<Text style={styles.headerTitle}>Notifications</Text>}
          rightContent={
            unreadCount > 0 ? (
              <TouchableOpacity
                onPress={markAsRead}
                style={styles.markAllButton}
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
              >
                <Text style={styles.markAllReadText}>Mark all</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />
      </BlurredHeader>

      <FlatList
        data={notifications}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={respondedRequests}
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: topInset, paddingBottom: insets.bottom },
        ]}
        scrollIndicatorInsets={{ top: topInset }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={listEmpty}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            progressViewOffset={topInset}
            tintColor={colors.textSecondary}
          />
        }
      />
    </View>
  )
}

const keyExtractor = (item: NotificationWithProfiles) => item.id

type NotificationRowProps = {
  notification: NotificationWithProfiles
  decision: FollowRequestDecision | undefined
  isResponding: boolean
  onPress: (notification: NotificationWithProfiles) => void
  onRespond: (requestId: string, decision: FollowRequestDecision) => void
  colors: Colors
  styles: Styles
}

const NotificationRow = memo(function NotificationRow({
  notification,
  decision,
  isResponding,
  onPress,
  onRespond,
  colors,
  styles,
}: NotificationRowProps) {
  const actorNames = notification.actorProfiles.map((p) => p.display_name)
  const isFollowRequest =
    notification.type === 'follow_request_received' &&
    Boolean(notification.request_id)
  const isSystemNotification =
    notification.type === 'trial_reminder' ||
    notification.type.startsWith('retention_') ||
    notification.type.startsWith('proactive_coach_')

  let { title, body } = formatNotificationText(
    notification.type,
    actorNames,
    notification.actors.length,
    notification.metadata,
  )
  let iconName = getNotificationIcon(notification.type)
  let iconColor = getNotificationIconColor(
    notification.read,
    colors.brandPrimary,
    colors.textSecondary,
  )

  // Reflect a follow request the user just responded to
  if (isFollowRequest && decision) {
    const firstActor = actorNames[0] || 'User'
    if (decision === 'approve') {
      title = 'Request Approved'
      body = `${firstActor} is now following you`
      iconName = 'checkmark-circle'
      iconColor = colors.brandPrimary
    } else {
      title = 'Request Declined'
      body = `You declined ${firstActor}'s follow request`
      iconName = 'close-circle'
      iconColor = colors.textSecondary
    }
  }

  const showFollowRequestActions = isFollowRequest && !decision
  const requestId = notification.request_id

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.read && styles.notificationItemUnread,
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      {/* Actor avatars or system icon */}
      <View style={styles.avatarsContainer}>
        {isSystemNotification || notification.actorProfiles.length === 0 ? (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons
              name={getNotificationIcon(notification.type) as any}
              size={18}
              color={colors.surface}
            />
          </View>
        ) : (
          notification.actorProfiles.slice(0, 2).map((actor, index) => (
            <View
              key={actor.id}
              style={[styles.avatarWrapper, index > 0 && styles.avatarOverlap]}
            >
              {actor.avatar_url ? (
                <Image
                  source={{ uri: actor.avatar_url }}
                  style={styles.avatar}
                  cachePolicy="memory-disk"
                  recyclingKey={actor.id}
                  transition={120}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {actor.display_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
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
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <Text style={styles.notificationBody}>{body}</Text>
        {showFollowRequestActions && requestId && (
          <View style={styles.followRequestActions}>
            <TouchableOpacity
              style={[styles.followRequestButton, styles.declineButton]}
              onPress={() => onRespond(requestId, 'decline')}
              disabled={isResponding}
            >
              {isResponding ? (
                <ActivityIndicator size="small" color={colors.statusError} />
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
              style={[styles.followRequestButton, styles.approveButton]}
              onPress={() => onRespond(requestId, 'approve')}
              disabled={isResponding}
            >
              {isResponding ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text style={styles.followRequestButtonText}>Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.notificationTime}>
          {formatTimeAgo(notification.created_at)}
        </Text>
      </View>

      {/* Unread indicator */}
      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  )
})

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
      backgroundColor: colors.bg,
    },
    backButton: {
      zIndex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    markAllButton: {
      padding: 4,
    },
    markAllReadText: {
      fontSize: 14,
      color: colors.brandPrimary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    contentContainer: {
      flexGrow: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 100,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    notificationItemUnread: {
      backgroundColor: colors.surfaceSubtle,
    },
    avatarsContainer: {
      flexDirection: 'row',
      marginRight: 12,
      marginTop: 2,
    },
    avatarWrapper: {
      borderWidth: 2,
      borderColor: colors.surface,
      borderRadius: 18,
    },
    avatarOverlap: {
      marginLeft: -8,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarPlaceholder: {
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.surface,
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
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    notificationTitleUnread: {
      color: colors.textPrimary,
    },
    notificationBody: {
      fontSize: 14,
      color: colors.textPrimary,
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
      color: colors.surface,
    },
    approveButton: {
      backgroundColor: colors.brandPrimary,
      borderColor: colors.brandPrimary,
    },
    declineButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    declineButtonText: {
      color: colors.statusError,
    },
    notificationTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.brandPrimary,
      marginLeft: 8,
      marginTop: 6,
    },
  })
}
