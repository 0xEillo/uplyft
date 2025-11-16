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
      | 'follow_request_received'
      | 'follow_request_approved'
      | 'follow_request_declined'
    workout_id: string | null
    request_id: string | null
    actors: string[]
    comment_preview: string | null
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
  data: {
    type: string
    workoutId?: string
    requestId?: string
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

    // 2. Fetch actor profiles for grouping message
    const { data: actors, error: actorsError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', notification.actors)

    if (actorsError) {
      console.error(
        '[send-push-notification] Error fetching actors:',
        actorsError,
      )
      // Continue with generic message
    }

    // 3. Format notification text based on type and actor count
    const actorCount = notification.actors.length
    const firstActor = actors?.[0]?.display_name || 'Someone'

    let title = ''
    let body = ''

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
    } else if (notification.type === 'follow_request_received') {
      title = 'Follow Request'
      body = `${firstActor} wants to follow you`
    } else if (notification.type === 'follow_request_approved') {
      title = 'Request Approved'
      body = `${firstActor} approved your follow request`
    } else if (notification.type === 'follow_request_declined') {
      title = 'Request Declined'
      body = `${firstActor} declined your follow request`
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

    const message: ExpoPushMessage = {
      to: profile.expo_push_token,
      sound: 'default',
      title,
      body,
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
