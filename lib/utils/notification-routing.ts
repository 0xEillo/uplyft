import type { NotificationType } from '@/types/database.types'

export type NotificationRouteInput = {
  type: NotificationType | string
  workout_id?: string | null
  actors?: string[] | null
  metadata?: Record<string, unknown> | null
}

export type NotificationHref =
  | string
  | {
      pathname: string
      params: Record<string, string>
    }

const LEGACY_ROUTE_ALIASES: Record<string, string> = {
  '/(tabs)/create-post': '/create-post',
}

const PROACTIVE_COACH_TYPES = new Set([
  'proactive_coach_workout_day_morning',
  'proactive_coach_missed_workout',
  'proactive_coach_comeback',
  'proactive_coach_post_workout_followup',
])

const COMMENT_TYPES = new Set([
  'workout_comment',
  'workout_comment_reply',
  'workout_comment_like',
  'workout_comment_mention',
])

const FOLLOW_REQUEST_TYPES = new Set([
  'follow_request_received',
  'follow_request_approved',
  'follow_request_declined',
])

const RETENTION_TRAIN_TYPES = new Set([
  'retention_scheduled_workout',
  'retention_streak_protection',
  'retention_inactivity',
])

const RETENTION_PROFILE_TYPES = new Set([
  'retention_weekly_recap',
  'retention_milestone',
])

function normalizeRoute(route: string): string {
  return LEGACY_ROUTE_ALIASES[route] ?? route
}

function workoutHref(
  pathname: '/workout/[workoutId]' | '/workout-comments/[workoutId]',
  workoutId: string,
  returnTo: string,
): NotificationHref {
  return {
    pathname,
    params: { workoutId, returnTo },
  }
}

/**
 * Resolves where a notification tap should navigate.
 * Shared by in-app notification center and push response handling.
 */
export function resolveNotificationRoute(
  notification: NotificationRouteInput,
  options: { returnTo: string } = { returnTo: '/(tabs)' },
): NotificationHref {
  const returnTo = options.returnTo || '/(tabs)'
  const metadataRoute =
    notification.metadata && typeof notification.metadata.route === 'string'
      ? notification.metadata.route
      : null

  if (metadataRoute) {
    return normalizeRoute(metadataRoute)
  }

  const { type, workout_id: workoutId } = notification

  if (FOLLOW_REQUEST_TYPES.has(type)) {
    return '/follow-requests'
  }

  if (type === 'follow_received') {
    const actorId = notification.actors?.[0]
    if (actorId) {
      return {
        pathname: '/user/[userId]',
        params: { userId: actorId, returnTo },
      }
    }
    return '/(tabs)'
  }

  if (COMMENT_TYPES.has(type) && workoutId) {
    return workoutHref('/workout-comments/[workoutId]', workoutId, returnTo)
  }

  if (
    (type === 'workout_like' || type === 'followed_workout_post') &&
    workoutId
  ) {
    return workoutHref('/workout/[workoutId]', workoutId, returnTo)
  }

  if (type === 'trial_reminder') {
    return '/(tabs)/profile'
  }

  if (RETENTION_TRAIN_TYPES.has(type)) {
    return '/create-post'
  }

  if (RETENTION_PROFILE_TYPES.has(type)) {
    return '/(tabs)/profile'
  }

  if (PROACTIVE_COACH_TYPES.has(type)) {
    return '/chat'
  }

  if (workoutId) {
    return workoutHref('/workout/[workoutId]', workoutId, returnTo)
  }

  return '/(tabs)'
}

/**
 * Resolve from push notification payload data fields.
 */
export function resolvePushNotificationRoute(
  data: {
    type?: string
    workoutId?: string
    route?: string
    actors?: string[]
  },
  options: { returnTo: string } = { returnTo: '/(tabs)' },
): NotificationHref {
  return resolveNotificationRoute(
    {
      type: data.type ?? '',
      workout_id: data.workoutId ?? null,
      actors: data.actors ?? null,
      metadata: data.route ? { route: data.route } : null,
    },
    options,
  )
}
