import type { NotificationType } from '@/types/database.types'

/**
 * Format notification text based on type and actors
 * @param type - The notification type ('workout_like' or 'workout_comment')
 * @param actorNames - Array of actor display names
 * @param actorCount - Total number of actors
 * @returns Formatted title and body text
 */
export function formatNotificationText(
  type: NotificationType,
  actorNames: string[],
  actorCount: number,
): { title: string; body: string } {
  const firstActor = actorNames[0] || 'Someone'

  if (type === 'workout_like') {
    return {
      title: 'New Like',
      body:
        actorCount === 1
          ? `${firstActor} liked your workout`
          : `${firstActor} and ${actorCount - 1} other${actorCount > 2 ? 's' : ''} liked your workout`,
    }
  } else if (type === 'workout_comment') {
    return {
      title: 'New Comment',
      body:
        actorCount === 1
          ? `${firstActor} commented on your workout`
          : `${firstActor} and ${actorCount - 1} other${actorCount > 2 ? 's' : ''} commented on your workout`,
    }
  } else if (type === 'follow_request_received') {
    return {
      title: 'Follow Request',
      body: `${firstActor} wants to follow you`,
    }
  } else if (type === 'follow_request_approved') {
    return {
      title: 'Request Approved',
      body: `${firstActor} approved your follow request`,
    }
  } else if (type === 'follow_request_declined') {
    return {
      title: 'Request Declined',
      body: `${firstActor} declined your follow request`,
    }
  }

  // Fallback for unknown types
  return {
    title: 'New Notification',
    body: `${firstActor} interacted with your workout`,
  }
}

/**
 * Get the appropriate Ionicon name for a notification type
 * @param type - The notification type
 * @returns Ionicon name as string
 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'workout_like':
      return 'thumbs-up'
    case 'workout_comment':
      return 'chatbubble'
    case 'follow_request_received':
      return 'person-add'
    case 'follow_request_approved':
      return 'checkmark-circle'
    case 'follow_request_declined':
      return 'close-circle'
    default:
      return 'notifications'
  }
}

/**
 * Get color for notification icon based on read status
 * @param isRead - Whether the notification has been read
 * @param primaryColor - App primary color
 * @param secondaryColor - Secondary color for read notifications
 * @returns Color string
 */
export function getNotificationIconColor(
  isRead: boolean,
  primaryColor: string,
  secondaryColor: string,
): string {
  return isRead ? secondaryColor : primaryColor
}
