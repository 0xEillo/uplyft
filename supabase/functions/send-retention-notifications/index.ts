import { createServiceClient } from '../_shared/supabase.ts'

type RetentionNotificationType =
  | 'retention_scheduled_workout'
  | 'retention_streak_protection'
  | 'retention_inactivity'
  | 'retention_weekly_recap'
  | 'retention_milestone'

type PreferenceRow = {
  user_id: string
  enabled: boolean
  scheduled_reminders_enabled: boolean
  streak_protection_enabled: boolean
  inactivity_enabled: boolean
  weekly_recaps_enabled: boolean
  milestones_enabled: boolean
  preferred_reminder_hour: number
  quiet_hours_start: string
  quiet_hours_end: string
  timezone: string
  max_pushes_per_week: number
  snoozed_until: string | null
  last_sent_at: string | null
  profile?:
    | {
        id: string
        display_name: string
        commitment: string[] | null
        expo_push_token: string | null
      }
    | null
}

type WorkoutRow = {
  user_id: string
  date: string
}

type ProfileRow = {
  id: string
  display_name: string
  commitment: string[] | null
  expo_push_token: string | null
}

type NotificationHistoryRow = {
  recipient_id: string
  type: string
  created_at: string
}

type CandidateMessage = {
  type: RetentionNotificationType
  title: string
  body: string
  route: string
  metadata: Record<string, unknown>
}

const RETENTION_TYPES: RetentionNotificationType[] = [
  'retention_scheduled_workout',
  'retention_streak_protection',
  'retention_inactivity',
  'retention_weekly_recap',
  'retention_milestone',
]

const DAY_MS = 24 * 60 * 60 * 1000
const LOOKBACK_WORKOUT_DAYS = 45
const LOOKBACK_HISTORY_DAYS = 35
const WEEKLY_RECAP_HOUR = 9
const STREAK_REMINDER_HOUR = 20
const INACTIVITY_REMINDER_HOUR = 18
const MILESTONE_REMINDER_HOUR = 10
const MIN_SPACING_HOURS = 20
const MILESTONES = [10, 25, 50, 100, 150, 200]

function getLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (year && month && day) {
    return `${year}-${month}-${day}`
  }

  // Fallback should never happen, but keep the scheduler resilient.
  return date.toISOString().split('T')[0]
}

function getLocalWeekday(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  })
    .format(date)
    .toLowerCase()
}

function getLocalHourAndMinute(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')

  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

function parseTimeToMinutes(value: string | null | undefined): number {
  if (!value) return 0
  const [hoursRaw, minutesRaw] = value.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0
  }

  return hours * 60 + minutes
}

function isWithinQuietHours(
  localMinutes: number,
  quietStart: string,
  quietEnd: string,
): boolean {
  const startMinutes = parseTimeToMinutes(quietStart)
  const endMinutes = parseTimeToMinutes(quietEnd)

  if (startMinutes === endMinutes) {
    return false
  }

  if (startMinutes < endMinutes) {
    return localMinutes >= startMinutes && localMinutes < endMinutes
  }

  return localMinutes >= startMinutes || localMinutes < endMinutes
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value))
  return new Date(Date.UTC(year, month - 1, day))
}

function diffDays(dateKeyA: string, dateKeyB: string): number {
  const a = parseDateKey(dateKeyA).getTime()
  const b = parseDateKey(dateKeyB).getTime()
  return Math.floor((a - b) / DAY_MS)
}

function toSortedUniqueDateKeys(
  workouts: WorkoutRow[],
  timezone: string,
): string[] {
  const keys = new Set<string>()

  for (const workout of workouts) {
    keys.add(getLocalDateKey(new Date(workout.date), timezone))
  }

  return Array.from(keys).sort((a, b) => b.localeCompare(a))
}

function getConsecutiveStreakEndingYesterday(
  workoutDateSet: Set<string>,
  todayDateKey: string,
): number {
  const todayDate = parseDateKey(todayDateKey)
  const cursor = new Date(todayDate)
  cursor.setUTCDate(cursor.getUTCDate() - 1)

  let streak = 0

  while (true) {
    const cursorKey = cursor.toISOString().split('T')[0]
    if (!workoutDateSet.has(cursorKey)) {
      break
    }

    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return streak
}

function getWeekKey(dateKey: string): string {
  const date = parseDateKey(dateKey)
  const day = date.getUTCDay()
  const diffToMonday = (day + 6) % 7
  date.setUTCDate(date.getUTCDate() - diffToMonday)
  return date.toISOString().split('T')[0]
}

function firstName(displayName: string): string {
  const trimmed = (displayName || '').trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0]
}

function withinLastHours(isoDate: string, now: Date, hours: number): boolean {
  const timestamp = new Date(isoDate).getTime()
  if (!Number.isFinite(timestamp)) return false

  return now.getTime() - timestamp < hours * 60 * 60 * 1000
}

function pickMessage(input: {
  pref: PreferenceRow
  now: Date
  timezone: string
  todayDateKey: string
  localHour: number
  localWeekday: string
  workouts: WorkoutRow[]
  history: NotificationHistoryRow[]
  totalWorkoutCount: number | null
}): CandidateMessage | null {
  const {
    pref,
    now,
    timezone,
    todayDateKey,
    localHour,
    localWeekday,
    workouts,
    history,
    totalWorkoutCount,
  } = input

  const dateKeys = toSortedUniqueDateKeys(workouts, timezone)
  const workoutDateSet = new Set(dateKeys)

  if (workoutDateSet.has(todayDateKey)) {
    return null
  }

  const lastWorkoutDate = dateKeys[0] ?? null
  const daysSinceLastWorkout =
    lastWorkoutDate !== null ? diffDays(todayDateKey, lastWorkoutDate) : null

  const retentionHistory = history.filter((item) =>
    RETENTION_TYPES.includes(item.type as RetentionNotificationType),
  )

  const hasRecentType = (type: RetentionNotificationType, hours: number) =>
    retentionHistory.some(
      (item) => item.type === type && withinLastHours(item.created_at, now, hours),
    )

  const commitmentDays = (pref.profile?.commitment ?? []).filter(
    (day) => day !== 'not_sure',
  )
  const hasCommitment = commitmentDays.length > 0
  const isCommitmentDay = hasCommitment
    ? commitmentDays.includes(localWeekday)
    : true

  const weeklyWindowCount = dateKeys.filter((dateKey) => {
    const delta = diffDays(todayDateKey, dateKey)
    return delta >= 0 && delta <= 6
  }).length

  const streakEndingYesterday = getConsecutiveStreakEndingYesterday(
    workoutDateSet,
    todayDateKey,
  )

  const localNowWeekKey = getWeekKey(todayDateKey)
  const hasWeeklyRecapThisWeek = retentionHistory.some((item) => {
    if (item.type !== 'retention_weekly_recap') {
      return false
    }

    const historyDateKey = getLocalDateKey(new Date(item.created_at), timezone)
    return getWeekKey(historyDateKey) === localNowWeekKey
  })

  if (
    pref.scheduled_reminders_enabled &&
    localHour === pref.preferred_reminder_hour &&
    isCommitmentDay &&
    !hasRecentType('retention_scheduled_workout', 20)
  ) {
    const name = firstName(pref.profile?.display_name ?? '')
    return {
      type: 'retention_scheduled_workout',
      title: 'Time to train 💪',
      body: `Hey ${name}, your workout slot is open. Ready to log it?`,
      route: '/(tabs)/create-post',
      metadata: {
        category: 'scheduled',
        weekday: localWeekday,
      },
    }
  }

  if (
    pref.streak_protection_enabled &&
    localHour === STREAK_REMINDER_HOUR &&
    streakEndingYesterday >= 3 &&
    !hasRecentType('retention_streak_protection', 48)
  ) {
    return {
      type: 'retention_streak_protection',
      title: `🔥 ${streakEndingYesterday}-day streak on the line`,
      body: 'Log today’s workout to keep your streak alive.',
      route: '/(tabs)/create-post',
      metadata: {
        category: 'streak',
        streakDays: streakEndingYesterday,
      },
    }
  }

  if (
    pref.inactivity_enabled &&
    localHour === INACTIVITY_REMINDER_HOUR &&
    daysSinceLastWorkout !== null &&
    daysSinceLastWorkout >= 3 &&
    !hasRecentType('retention_inactivity', 72)
  ) {
    if (daysSinceLastWorkout === 3) {
      return {
        type: 'retention_inactivity',
        title: 'Quick reset today? 💪',
        body: 'You’re 3 days out. A short session gets momentum back.',
        route: '/(tabs)/create-post',
        metadata: {
          category: 'inactivity',
          daysSinceLastWorkout,
          stage: 'soft',
        },
      }
    }

    if (daysSinceLastWorkout === 7) {
      return {
        type: 'retention_inactivity',
        title: 'One-week check-in',
        body: 'No pressure. Even 20 minutes today is a win.',
        route: '/(tabs)/create-post',
        metadata: {
          category: 'inactivity',
          daysSinceLastWorkout,
          stage: 'medium',
        },
      }
    }

    if (
      daysSinceLastWorkout >= 14 &&
      (daysSinceLastWorkout === 14 || (daysSinceLastWorkout - 14) % 4 === 0)
    ) {
      return {
        type: 'retention_inactivity',
        title: 'Ready to come back stronger?',
        body: `It’s been ${daysSinceLastWorkout} days. Start light and rebuild momentum.`,
        route: '/(tabs)/create-post',
        metadata: {
          category: 'inactivity',
          daysSinceLastWorkout,
          stage: 'strong',
        },
      }
    }
  }

  if (
    pref.weekly_recaps_enabled &&
    localWeekday === 'monday' &&
    localHour === WEEKLY_RECAP_HOUR &&
    weeklyWindowCount > 0 &&
    !hasWeeklyRecapThisWeek
  ) {
    return {
      type: 'retention_weekly_recap',
      title: 'Weekly recap 📈',
      body: `${weeklyWindowCount} workouts in 7 days. Let’s top that this week.`,
      route: '/(tabs)/profile',
      metadata: {
        category: 'weekly_recap',
        workoutsLast7Days: weeklyWindowCount,
      },
    }
  }

  if (
    pref.milestones_enabled &&
    localHour === MILESTONE_REMINDER_HOUR &&
    daysSinceLastWorkout === 1 &&
    totalWorkoutCount !== null &&
    MILESTONES.includes(totalWorkoutCount) &&
    !hasRecentType('retention_milestone', 24 * 7)
  ) {
    return {
      type: 'retention_milestone',
      title: 'Milestone unlocked 🎉',
      body: `${totalWorkoutCount} workouts logged. You’re building real consistency.`,
      route: '/(tabs)/profile',
      metadata: {
        category: 'milestone',
        workoutCount: totalWorkoutCount,
      },
    }
  }

  return null
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('RETENTION_SCHEDULER_SECRET')
    if (secret && req.headers.get('x-retention-secret') !== secret) {
      return new Response(
        JSON.stringify({ success: false, error: 'unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const url = new URL(req.url)
    const queryDryRun = url.searchParams.get('dryRun') === 'true'
    const queryUserId = url.searchParams.get('userId')

    let body: { dryRun?: boolean; userId?: string } = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    const dryRun = body.dryRun === true || queryDryRun
    const scopedUserId = body.userId || queryUserId || null

    const supabase = createServiceClient()
    const now = new Date()

    let prefQuery = supabase
      .from('retention_push_preferences')
      .select(
        `
          user_id,
          enabled,
          scheduled_reminders_enabled,
          streak_protection_enabled,
          inactivity_enabled,
          weekly_recaps_enabled,
          milestones_enabled,
          preferred_reminder_hour,
          quiet_hours_start,
          quiet_hours_end,
          timezone,
          max_pushes_per_week,
          snoozed_until,
          last_sent_at
        `,
      )
      .eq('enabled', true)

    if (scopedUserId) {
      prefQuery = prefQuery.eq('user_id', scopedUserId)
    }

    const { data: prefRowsRaw, error: prefError } = await prefQuery

    if (prefError) {
      throw prefError
    }

    const prefRows = (prefRowsRaw || []) as PreferenceRow[]
    if (prefRows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processedUsers: 0,
          queued: 0,
          dryRun,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, commitment, expo_push_token')
      .in(
        'id',
        prefRows.map((pref) => pref.user_id),
      )

    if (profileError) {
      throw profileError
    }

    const profileById = new Map<string, ProfileRow>(
      ((profileRows || []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile,
      ]),
    )

    const normalizedPrefs = prefRows.map((pref) => ({
      ...pref,
      profile: profileById.get(pref.user_id) || null,
    }))
    const candidates = normalizedPrefs.filter((pref) => {
      const token = pref.profile?.expo_push_token
      return !!token
    })

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processedUsers: 0,
          queued: 0,
          dryRun,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const userIds = candidates.map((pref) => pref.user_id)

    const workoutLookback = new Date(now.getTime() - LOOKBACK_WORKOUT_DAYS * DAY_MS)
    const historyLookback = new Date(now.getTime() - LOOKBACK_HISTORY_DAYS * DAY_MS)
    const weeklyLimitLookback = new Date(now.getTime() - 7 * DAY_MS)

    const [workoutsResult, historyResult] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('user_id, date')
        .in('user_id', userIds)
        .gte('date', workoutLookback.toISOString()),
      supabase
        .from('notifications')
        .select('recipient_id, type, created_at')
        .in('recipient_id', userIds)
        .in('type', RETENTION_TYPES)
        .gte('created_at', historyLookback.toISOString()),
    ])

    if (workoutsResult.error) {
      throw workoutsResult.error
    }

    if (historyResult.error) {
      throw historyResult.error
    }

    const workoutsByUser = new Map<string, WorkoutRow[]>()
    for (const workout of (workoutsResult.data || []) as WorkoutRow[]) {
      const list = workoutsByUser.get(workout.user_id) || []
      list.push(workout)
      workoutsByUser.set(workout.user_id, list)
    }

    const historyByUser = new Map<string, NotificationHistoryRow[]>()
    for (const row of (historyResult.data || []) as NotificationHistoryRow[]) {
      const list = historyByUser.get(row.recipient_id) || []
      list.push(row)
      historyByUser.set(row.recipient_id, list)
    }

    const workoutCountCache = new Map<string, number>()
    const getTotalWorkoutCount = async (userId: string): Promise<number> => {
      if (workoutCountCache.has(userId)) {
        return workoutCountCache.get(userId) || 0
      }

      const { count, error } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      const resolved = count || 0
      workoutCountCache.set(userId, resolved)
      return resolved
    }

    const queued: {
      userId: string
      type: RetentionNotificationType
      title: string
      body: string
      route: string
      dryRun: boolean
    }[] = []

    const skipped: { userId: string; reason: string }[] = []

    for (const pref of candidates) {
      const timezone = pref.timezone || 'UTC'
      const { hour: localHour, minute: localMinute } = getLocalHourAndMinute(
        now,
        timezone,
      )
      const localMinutes = localHour * 60 + localMinute

      if (
        isWithinQuietHours(
          localMinutes,
          pref.quiet_hours_start,
          pref.quiet_hours_end,
        )
      ) {
        skipped.push({ userId: pref.user_id, reason: 'quiet_hours' })
        continue
      }

      if (pref.snoozed_until && new Date(pref.snoozed_until) > now) {
        skipped.push({ userId: pref.user_id, reason: 'snoozed' })
        continue
      }

      const userHistory = historyByUser.get(pref.user_id) || []
      const pushesLast7Days = userHistory.filter(
        (item) => new Date(item.created_at) >= weeklyLimitLookback,
      ).length

      if (pushesLast7Days >= pref.max_pushes_per_week) {
        skipped.push({ userId: pref.user_id, reason: 'weekly_limit' })
        continue
      }

      const latestPush = userHistory.reduce<NotificationHistoryRow | null>(
        (latest, item) => {
          if (!latest) return item
          return item.created_at > latest.created_at ? item : latest
        },
        null,
      )

      if (latestPush && withinLastHours(latestPush.created_at, now, MIN_SPACING_HOURS)) {
        skipped.push({ userId: pref.user_id, reason: 'min_spacing' })
        continue
      }

      const todayDateKey = getLocalDateKey(now, timezone)
      const localWeekday = getLocalWeekday(now, timezone)
      const workouts = workoutsByUser.get(pref.user_id) || []

      let totalWorkoutCount: number | null = null
      if (pref.milestones_enabled && localHour === MILESTONE_REMINDER_HOUR) {
        totalWorkoutCount = await getTotalWorkoutCount(pref.user_id)
      }

      const message = pickMessage({
        pref,
        now,
        timezone,
        todayDateKey,
        localHour,
        localWeekday,
        workouts,
        history: userHistory,
        totalWorkoutCount,
      })

      if (!message) {
        skipped.push({ userId: pref.user_id, reason: 'no_eligible_message' })
        continue
      }

      queued.push({
        userId: pref.user_id,
        type: message.type,
        title: message.title,
        body: message.body,
        route: message.route,
        dryRun,
      })

      if (dryRun) {
        continue
      }

      const { error: insertError } = await supabase.from('notifications').insert({
        recipient_id: pref.user_id,
        type: message.type,
        actors: [],
        read: false,
        metadata: {
          title: message.title,
          body: message.body,
          route: message.route,
          source: 'retention_scheduler',
          generated_at: now.toISOString(),
          ...message.metadata,
        },
      })

      if (insertError) {
        console.error(
          '[send-retention-notifications] Failed to insert notification',
          pref.user_id,
          insertError,
        )
        skipped.push({ userId: pref.user_id, reason: 'insert_failed' })
        continue
      }

      await supabase
        .from('retention_push_preferences')
        .update({ last_sent_at: now.toISOString() })
        .eq('user_id', pref.user_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        processedUsers: candidates.length,
        queued: queued.length,
        queuedPreview: queued.slice(0, 50),
        skippedSummary: skipped.reduce<Record<string, number>>((acc, item) => {
          acc[item.reason] = (acc[item.reason] || 0) + 1
          return acc
        }, {}),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('[send-retention-notifications] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
