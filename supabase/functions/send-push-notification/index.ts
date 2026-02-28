import { createServiceClient } from '../_shared/supabase.ts'

interface NotificationPayload {
  type: 'INSERT' | 'UPDATE'
  table: string
  record: {
    id: string
    recipient_id: string
    type:
      | 'workout_like'
      | 'workout_comment'
      | 'workout_comment_reply'
      | 'workout_comment_like'
      | 'follow_request_received'
      | 'follow_request_approved'
      | 'follow_request_declined'
      | 'follow_received'
      | 'trial_reminder'
      | 'retention_scheduled_workout'
      | 'retention_streak_protection'
      | 'retention_inactivity'
      | 'retention_weekly_recap'
      | 'retention_milestone'
    workout_id: string | null
    request_id: string | null
    follow_id: string | null
    actors: string[]
    comment_preview: string | null
    metadata: Record<string, unknown> | null
    read: boolean
    created_at: string
    updated_at: string
  }
  old_record: any
}

interface ExpoPushMessage {
  to: string
  sound: 'default'
  title: string
  body: string
  channelId?: string
  data: {
    type: string
    workoutId?: string
    requestId?: string
    route?: string
    notificationId: string
  }
  badge?: number
}

Deno.serve(async (req) => {
  try {
    // Parse webhook payload
    const payload: NotificationPayload = await req.json()
    console.log(
      '[send-push-notification] Received payload:',
      JSON.stringify(payload),
    )

    const notification = payload.record

    // Skip if notification is already read (for UPDATE events)
    if (payload.type === 'UPDATE' && notification.read) {
      console.log(
        '[send-push-notification] Notification already read, skipping',
      )
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'already_read',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Initialize Supabase client with service role
    const supabase = createServiceClient()

    // 1. Get recipient's push token and display name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token, display_name')
      .eq('id', notification.recipient_id)
      .single()

    if (profileError) {
      console.error(
        '[send-push-notification] Error fetching profile:',
        profileError,
      )
      return new Response(
        JSON.stringify({ success: false, error: 'profile_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!profile?.expo_push_token) {
      console.log('[send-push-notification] No push token for user, skipping')
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_token' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 2. Fetch actor profiles for grouping message when this notification has actors
    let actors: { id: string; display_name: string }[] = []
    if (notification.actors?.length > 0) {
      const { data: actorRows, error: actorsError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', notification.actors)

      if (actorsError) {
        console.error(
          '[send-push-notification] Error fetching actors:',
          actorsError,
        )
        // Continue with generic message
      } else {
        actors = actorRows || []
      }
    }

    // 3. Format notification text based on type and actor count
    const actorCount = notification.actors.length
    const firstActor = actors?.[0]?.display_name || 'Someone'

    let title = ''
    let body = ''

    const metadata = notification.metadata || {}
    const metadataTitle =
      typeof metadata.title === 'string' ? metadata.title : undefined
    const metadataBody =
      typeof metadata.body === 'string' ? metadata.body : undefined
    const metadataRoute =
      typeof metadata.route === 'string' ? metadata.route : undefined

    const isRetentionType =
      notification.type === 'trial_reminder' ||
      notification.type.startsWith('retention_')

    if (notification.type === 'workout_like') {
      title = 'New Like'
      if (actorCount === 1) {
        body = `${firstActor} liked your workout`
      } else {
        body = `${firstActor} and ${actorCount - 1} other${
          actorCount > 2 ? 's' : ''
        } liked your workout`
      }
    } else if (notification.type === 'workout_comment') {
      title = 'New Comment'
      if (actorCount === 1) {
        body = `${firstActor} commented on your workout`
      } else {
        body = `${firstActor} and ${actorCount - 1} other${
          actorCount > 2 ? 's' : ''
        } commented on your workout`
      }
    } else if (notification.type === 'workout_comment_reply') {
      title = 'New Reply'
      if (actorCount === 1) {
        body = `${firstActor} replied to your comment`
      } else {
        body = `${firstActor} and ${actorCount - 1} other${
          actorCount > 2 ? 's' : ''
        } replied to your comment`
      }
    } else if (notification.type === 'workout_comment_like') {
      title = 'Comment Like'
      if (actorCount === 1) {
        body = `${firstActor} liked your comment`
      } else {
        body = `${firstActor} and ${actorCount - 1} other${
          actorCount > 2 ? 's' : ''
        } liked your comment`
      }
    } else if (notification.type === 'follow_request_received') {
      title = 'Follow Request'
      body = `${firstActor} wants to follow you`
    } else if (notification.type === 'follow_request_approved') {
      title = 'Request Approved'
      body = `${firstActor} approved your follow request`
    } else if (notification.type === 'follow_request_declined') {
      title = 'Request Declined'
      body = `${firstActor} declined your follow request`
    } else if (notification.type === 'follow_received') {
      title = 'New Follower'
      if (actorCount === 1) {
        body = `${firstActor} started following you`
      } else {
        body = `${firstActor} and ${actorCount - 1} other${
          actorCount > 2 ? 's' : ''
        } started following you`
      }
    } else if (isRetentionType) {
      if (notification.type === 'trial_reminder') {
        title = metadataTitle || 'Trial Ending Soon'
        body =
          metadataBody ||
          'Your free trial ends soon. Keep your progress going.'
      } else if (notification.type === 'retention_scheduled_workout') {
        title = metadataTitle || 'Time to train 💪'
        body = metadataBody || 'Your workout slot is open. Ready to log it?'
      } else if (notification.type === 'retention_streak_protection') {
        title = metadataTitle || 'Streak check 🔥'
        body = metadataBody || 'Log a quick session to keep momentum alive.'
      } else if (notification.type === 'retention_inactivity') {
        title = metadataTitle || 'Comeback session?'
        body = metadataBody || 'A short workout today can restart momentum.'
      } else if (notification.type === 'retention_weekly_recap') {
        title = metadataTitle || 'Weekly recap 📈'
        body = metadataBody || 'Check your recent progress and plan your week.'
      } else {
        title = metadataTitle || 'Milestone unlocked 🎉'
        body = metadataBody || 'You hit a new milestone. Keep building.'
      }
    } else {
      console.error(
        '[send-push-notification] Unknown notification type:',
        notification.type,
      )
      return new Response(
        JSON.stringify({ success: false, error: 'unknown_type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 4. Build push notification message
    const messageData: ExpoPushMessage['data'] = {
      type: notification.type,
      notificationId: notification.id,
    }

    // Add workoutId only for workout-related notifications
    if (notification.workout_id) {
      messageData.workoutId = notification.workout_id
    }

    // Add requestId only for follow request notifications
    if (notification.request_id) {
      messageData.requestId = notification.request_id
    }

    if (metadataRoute) {
      messageData.route = metadataRoute
    }

    const channelIdByType: Record<string, string> = {
      workout_like: 'social',
      workout_comment: 'social',
      workout_comment_reply: 'social',
      workout_comment_like: 'social',
      follow_request_received: 'social',
      follow_request_approved: 'social',
      follow_request_declined: 'social',
      follow_received: 'social',
      trial_reminder: 'default',
      retention_scheduled_workout: 'retention_scheduled',
      retention_streak_protection: 'retention_streak',
      retention_inactivity: 'retention_inactivity',
      retention_weekly_recap: 'retention_weekly',
      retention_milestone: 'retention_milestone',
    }

    const channelId = channelIdByType[notification.type] || 'default'

    const message: ExpoPushMessage = {
      to: profile.expo_push_token,
      sound: 'default',
      title,
      body,
      channelId,
      data: messageData,
      badge: 1, // iOS badge increment
    }

    console.log(
      '[send-push-notification] Sending push:',
      JSON.stringify(message),
    )

    // 5. Send push notification via Expo's API
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    const expoResult = await expoResponse.json()
    console.log(
      '[send-push-notification] Expo API result:',
      JSON.stringify(expoResult),
    )

    // Check for Expo API errors
    if (!expoResponse.ok || expoResult.errors) {
      console.error('[send-push-notification] Expo API error:', expoResult)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'expo_api_error',
          details: expoResult,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        expoResponse: expoResult,
        notificationId: notification.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[send-push-notification] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
