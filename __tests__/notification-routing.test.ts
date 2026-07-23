import {
  resolveNotificationRoute,
  resolvePushNotificationRoute,
} from '@/lib/utils/notification-routing'

describe('resolveNotificationRoute', () => {
  const returnTo = '/notifications'

  it('normalizes legacy retention metadata.route to /create-post', () => {
    expect(
      resolveNotificationRoute(
        {
          type: 'retention_scheduled_workout',
          metadata: { route: '/(tabs)/create-post' },
        },
        { returnTo },
      ),
    ).toBe('/create-post')
  })

  it('uses type fallback /create-post when retention has no metadata', () => {
    expect(
      resolveNotificationRoute(
        { type: 'retention_streak_protection' },
        { returnTo },
      ),
    ).toBe('/create-post')
  })

  it('routes follow_received to the follower profile', () => {
    expect(
      resolveNotificationRoute(
        { type: 'follow_received', actors: ['user-abc'] },
        { returnTo },
      ),
    ).toEqual({
      pathname: '/user/[userId]',
      params: { userId: 'user-abc', returnTo },
    })
  })

  it('routes follow_received without actors to feed', () => {
    expect(
      resolveNotificationRoute({ type: 'follow_received' }, { returnTo }),
    ).toBe('/(tabs)')
  })

  it('routes follow request types to /follow-requests', () => {
    expect(
      resolveNotificationRoute(
        { type: 'follow_request_received' },
        { returnTo },
      ),
    ).toBe('/follow-requests')
  })

  it('routes proactive coach types to /chat', () => {
    expect(
      resolveNotificationRoute(
        { type: 'proactive_coach_missed_workout' },
        { returnTo },
      ),
    ).toBe('/chat')
  })

  it('honors proactive coach metadata.route', () => {
    expect(
      resolveNotificationRoute(
        {
          type: 'proactive_coach_comeback',
          metadata: { route: '/chat' },
        },
        { returnTo },
      ),
    ).toBe('/chat')
  })

  it('routes comment types to comments view', () => {
    expect(
      resolveNotificationRoute(
        { type: 'workout_comment', workout_id: 'w1' },
        { returnTo },
      ),
    ).toEqual({
      pathname: '/workout-comments/[workoutId]',
      params: { workoutId: 'w1', returnTo },
    })
  })

  it('routes likes and followed posts to workout detail', () => {
    expect(
      resolveNotificationRoute(
        { type: 'workout_like', workout_id: 'w1' },
        { returnTo },
      ),
    ).toEqual({
      pathname: '/workout/[workoutId]',
      params: { workoutId: 'w1', returnTo },
    })
  })

  it('falls back to workout detail for unknown types with workout_id', () => {
    expect(
      resolveNotificationRoute(
        { type: 'some_future_type', workout_id: 'w1' },
        { returnTo },
      ),
    ).toEqual({
      pathname: '/workout/[workoutId]',
      params: { workoutId: 'w1', returnTo },
    })
  })

  it('routes trial and recap types to profile', () => {
    expect(
      resolveNotificationRoute({ type: 'trial_reminder' }, { returnTo }),
    ).toBe('/(tabs)/profile')
    expect(
      resolveNotificationRoute({ type: 'retention_weekly_recap' }, { returnTo }),
    ).toBe('/(tabs)/profile')
  })

  it('falls back to feed for unknown types without workout_id', () => {
    expect(
      resolveNotificationRoute({ type: 'unknown' }, { returnTo }),
    ).toBe('/(tabs)')
  })
})

describe('resolvePushNotificationRoute', () => {
  it('matches in-app resolution for follow_received', () => {
    const returnTo = '/(tabs)'
    expect(
      resolvePushNotificationRoute(
        { type: 'follow_received', actors: ['user-abc'] },
        { returnTo },
      ),
    ).toEqual(
      resolveNotificationRoute(
        { type: 'follow_received', actors: ['user-abc'] },
        { returnTo },
      ),
    )
  })

  it('normalizes legacy route from push data.route', () => {
    expect(
      resolvePushNotificationRoute({
        type: 'retention_inactivity',
        route: '/(tabs)/create-post',
      }),
    ).toBe('/create-post')
  })
})
