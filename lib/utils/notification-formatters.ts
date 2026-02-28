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
  metadata?: Record<string, any> | null,
): { title: string; body: string } {
  const metadataTitle =
    metadata && typeof metadata.title === 'string' ? metadata.title : null
  const metadataBody =
    metadata && typeof metadata.body === 'string' ? metadata.body : null

  if ((type === 'trial_reminder' || type.startsWith('retention_')) && metadataTitle && metadataBody) {
    return {
      title: metadataTitle,
      body: metadataBody,
    }
  }

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
  } else if (type === 'follow_received') {
    return {
      title: 'New Follower',
      body:
        actorCount === 1
          ? `${firstActor} started following you`
          : `${firstActor} and ${actorCount - 1} other${actorCount > 2 ? 's' : ''} started following you`,
    }
  } else if (type === 'trial_reminder') {
    return {
      title: 'Trial Ending Soon',
      body: 'Your free trial ends in 2 days. Keep crushing your fitness goals!',
    }
  } else if (type === 'retention_scheduled_workout') {
    return {
      title: 'Time to train 💪',
      body: 'Your next workout is ready. Tap to start.',
    }
  } else if (type === 'retention_streak_protection') {
    return {
      title: 'Streak check 🔥',
      body: 'A quick workout today keeps your streak alive.',
    }
  } else if (type === 'retention_inactivity') {
    return {
      title: 'Comeback session?',
      body: 'A short workout can restart your momentum.',
    }
  } else if (type === 'retention_weekly_recap') {
    return {
      title: 'Weekly recap 📈',
      body: 'Review your week and set your next target.',
    }
  } else if (type === 'retention_milestone') {
    return {
      title: 'Milestone unlocked 🎉',
      body: 'You hit a new training milestone.',
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
    case 'follow_received':
      return 'person'
    case 'trial_reminder':
      return 'time'
    case 'retention_scheduled_workout':
      return 'barbell'
    case 'retention_streak_protection':
      return 'flame'
    case 'retention_inactivity':
      return 'refresh'
    case 'retention_weekly_recap':
      return 'stats-chart'
    case 'retention_milestone':
      return 'trophy'
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
