// eslint-disable-next-line import/no-unresolved
import { generateText } from 'npm:ai'
import type { CommitmentDay } from '../_shared/commitment.ts'
import { getCoach } from '../_shared/coaches.ts'
import {
  addDays,
  diffDays,
  firstName,
  getAdaptiveWeeklyPushLimit,
  getLocalDateKey,
  getLocalHourAndMinute,
  getLocalWeekday,
  getScheduledReminderPlan,
  isWithinQuietHours,
  parseDateKey,
  toSortedUniqueDateKeys,
} from '../_shared/retention.ts'
import { GEMINI_FLASH_LATEST_MODEL, openrouter } from '../_shared/openrouter.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { buildSystemPrompt } from '../chat/system-prompt.ts'
import { buildUserContextSummary } from '../chat/user-context.ts'

type ProactiveTriggerType =
  | 'workout_day_morning'
  | 'missed_workout'
  | 'comeback'
  | 'post_workout_followup'

type PreferenceRow = {
  user_id: string
  enabled: boolean
  proactive_coach_enabled: boolean
  scheduled_reminders_enabled: boolean
  inactivity_enabled: boolean
  preferred_reminder_hour: number
  quiet_hours_start: string
  quiet_hours_end: string
  timezone: string
  max_pushes_per_week: number
  snoozed_until: string | null
  profile?:
    | {
        id: string
        display_name: string
        commitment: string[] | null
        commitment_frequency: string | null
        expo_push_token: string | null
        coach: string | null
      }
    | null
}

type WorkoutRow = {
  user_id: string
  date: string
}

type NotificationHistoryRow = {
  recipient_id: string
  type: string
  created_at: string
}

type ProactiveHistoryRow = {
  user_id: string
  trigger_type: ProactiveTriggerType
  created_at: string
}

type ProactiveTrigger = {
  type: ProactiveTriggerType
  metadata: Record<string, unknown>
}

const DAY_MS = 24 * 60 * 60 * 1000
const LOOKBACK_WORKOUT_DAYS = 45
const LOOKBACK_HISTORY_DAYS = 35
const INACTIVITY_REMINDER_HOUR = 18
const POST_WORKOUT_FOLLOWUP_HOUR = 9
const MIN_SPACING_HOURS = 22
const RETENTION_NOTIFICATION_TYPES = [
  'retention_scheduled_workout',
  'retention_streak_protection',
  'retention_inactivity',
  'retention_weekly_recap',
  'retention_milestone',
]
const PROACTIVE_NOTIFICATION_TYPES = [
  'proactive_coach_workout_day_morning',
  'proactive_coach_missed_workout',
  'proactive_coach_comeback',
  'proactive_coach_post_workout_followup',
]
const PUSH_LIMIT_NOTIFICATION_TYPES = [
  ...RETENTION_NOTIFICATION_TYPES,
  ...PROACTIVE_NOTIFICATION_TYPES,
]

function withinLastHours(isoDate: string, now: Date, hours: number): boolean {
  const timestamp = new Date(isoDate).getTime()
  if (!Number.isFinite(timestamp)) return false
  return now.getTime() - timestamp < hours * 60 * 60 * 1000
}

function weekdayFromDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
  })
    .format(parseDateKey(dateKey))
    .toLowerCase()
}

function toCommitmentWeekday(value: string): Exclude<CommitmentDay, 'not_sure'> {
  if (
    value === 'sunday' ||
    value === 'monday' ||
    value === 'tuesday' ||
    value === 'wednesday' ||
    value === 'thursday' ||
    value === 'friday' ||
    value === 'saturday'
  ) {
    return value
  }

  return 'monday'
}

function getComebackStage(daysSinceLastWorkout: number): 'soft' | 'medium' | 'strong' {
  if (daysSinceLastWorkout >= 14) return 'strong'
  if (daysSinceLastWorkout >= 7) return 'medium'
  return 'soft'
}

function truncatePushBody(value: string, maxLength = 140): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

function pickProactiveTrigger(input: {
  pref: PreferenceRow
  timezone: string
  todayDateKey: string
  localHour: number
  localWeekday: string
  workouts: WorkoutRow[]
  proactiveHistory: ProactiveHistoryRow[]
}): ProactiveTrigger | null {
  const {
    pref,
    timezone,
    todayDateKey,
    localHour,
    localWeekday,
    workouts,
    proactiveHistory,
  } = input

  const dateKeys = toSortedUniqueDateKeys(workouts, timezone)
  const workoutDateSet = new Set(dateKeys)

  if (workoutDateSet.has(todayDateKey)) {
    return null
  }

  const lastWorkoutDate = dateKeys[0] ?? null
  const daysSinceLastWorkout =
    lastWorkoutDate !== null ? diffDays(todayDateKey, lastWorkoutDate) : null

  const scheduledReminderPlan = getScheduledReminderPlan({
    todayDateKey,
    localWeekday: toCommitmentWeekday(localWeekday),
    workoutDateKeys: dateKeys,
    commitment: pref.profile?.commitment,
    commitmentFrequency: pref.profile?.commitment_frequency,
  })

  if (
    pref.scheduled_reminders_enabled &&
    localHour === pref.preferred_reminder_hour &&
    scheduledReminderPlan.shouldSendScheduledReminderToday
  ) {
    return {
      type: 'workout_day_morning',
      metadata: {
        weekday: localWeekday,
        weeklyTarget: scheduledReminderPlan.weeklyTarget,
        workoutsThisWeek: scheduledReminderPlan.workoutsThisWeek,
        workoutsRemainingThisWeek:
          scheduledReminderPlan.workoutsRemainingThisWeek,
        urgency: scheduledReminderPlan.needsWorkoutTodayToHitGoal
          ? 'must_train_today'
          : scheduledReminderPlan.isBehindWeeklyPace
          ? 'behind_pace'
          : scheduledReminderPlan.isPlannedWorkoutDay
          ? 'planned_day'
          : 'open_goal',
      },
    }
  }

  const yesterdayDateKey = addDays(todayDateKey, -1)
  const yesterdayReminderPlan = getScheduledReminderPlan({
    todayDateKey: yesterdayDateKey,
    localWeekday: toCommitmentWeekday(weekdayFromDateKey(yesterdayDateKey)),
    workoutDateKeys: dateKeys,
    commitment: pref.profile?.commitment,
    commitmentFrequency: pref.profile?.commitment_frequency,
  })

  if (
    pref.scheduled_reminders_enabled &&
    localHour === pref.preferred_reminder_hour &&
    yesterdayReminderPlan.isPlannedWorkoutDay &&
    !workoutDateSet.has(yesterdayDateKey)
  ) {
    return {
      type: 'missed_workout',
      metadata: {
        missedDay: yesterdayDateKey,
        weeklyTarget: yesterdayReminderPlan.weeklyTarget,
      },
    }
  }

  if (
    pref.inactivity_enabled &&
    localHour === INACTIVITY_REMINDER_HOUR &&
    daysSinceLastWorkout !== null &&
    daysSinceLastWorkout >= 3
  ) {
    return {
      type: 'comeback',
      metadata: {
        daysSinceLastWorkout,
        lastWorkoutDate,
        stage: getComebackStage(daysSinceLastWorkout),
      },
    }
  }

  const hadPostWorkoutFollowupToday = proactiveHistory.some((item) => {
    if (item.trigger_type !== 'post_workout_followup') return false
    return getLocalDateKey(new Date(item.created_at), timezone) === todayDateKey
  })

  if (
    localHour === POST_WORKOUT_FOLLOWUP_HOUR &&
    lastWorkoutDate === yesterdayDateKey &&
    !hadPostWorkoutFollowupToday
  ) {
    return {
      type: 'post_workout_followup',
      metadata: {
        workoutDate: lastWorkoutDate,
      },
    }
  }

  return null
}

function buildProactiveInstruction(input: {
  trigger: ProactiveTrigger
  displayName: string
}): string {
  const name = firstName(input.displayName)
  const base =
    'You are sending the first message in an existing one-to-one coach chat. Write only the assistant message body. Keep it to 1-2 short sentences, no markdown, no JSON, no push-notification framing, and ask exactly one easy question the user can reply to.'

  if (input.trigger.type === 'workout_day_morning') {
    return `${base}\nMoment: It is ${name}'s planned workout morning. Be specific to their training context where possible and invite them to start the session.`
  }

  if (input.trigger.type === 'missed_workout') {
    return `${base}\nMoment: ${name} missed a planned workout yesterday. Be calm and non-shaming; help them decide how to recover the week.`
  }

  if (input.trigger.type === 'comeback') {
    return `${base}\nMoment: ${name} has not logged a workout for ${input.trigger.metadata.daysSinceLastWorkout} days. Stage is ${input.trigger.metadata.stage}. Make the comeback feel manageable.`
  }

  return `${base}\nMoment: It is the morning after ${name} logged a workout. Ask how recovery is going and reference their recent training context if useful.`
}

Deno.serve(async (req) => {
  try {
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
          proactive_coach_enabled,
          scheduled_reminders_enabled,
          inactivity_enabled,
          preferred_reminder_hour,
          quiet_hours_start,
          quiet_hours_end,
          timezone,
          max_pushes_per_week,
          snoozed_until
        `,
      )
      .eq('enabled', true)
      .eq('proactive_coach_enabled', true)

    if (scopedUserId) {
      prefQuery = prefQuery.eq('user_id', scopedUserId)
    }

    const { data: prefRowsRaw, error: prefError } = await prefQuery
    if (prefError) throw prefError

    const prefRows = (prefRowsRaw || []) as PreferenceRow[]
    if (prefRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, dryRun, processedUsers: 0, queued: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, commitment, commitment_frequency, expo_push_token, coach')
      .in(
        'id',
        prefRows.map((pref) => pref.user_id),
      )
    if (profileError) throw profileError

    const profileById = new Map<string, NonNullable<PreferenceRow['profile']>>(
      ((profileRows || []) as NonNullable<PreferenceRow['profile']>[]).map(
        (profile) => [profile.id, profile],
      ),
    )

    const candidates = prefRows.map((pref) => ({
      ...pref,
      profile: profileById.get(pref.user_id) || null,
    }))

    const userIds = candidates.map((pref) => pref.user_id)
    const workoutLookback = new Date(now.getTime() - LOOKBACK_WORKOUT_DAYS * DAY_MS)
    const historyLookback = new Date(now.getTime() - LOOKBACK_HISTORY_DAYS * DAY_MS)
    const weeklyLimitLookback = new Date(now.getTime() - 7 * DAY_MS)

    const [workoutsResult, notificationsResult, proactiveResult] =
      await Promise.all([
        supabase
          .from('workout_sessions')
          .select('user_id, date')
          .in('user_id', userIds)
          .gte('date', workoutLookback.toISOString()),
        supabase
          .from('notifications')
          .select('recipient_id, type, created_at')
          .in('recipient_id', userIds)
          .in('type', PUSH_LIMIT_NOTIFICATION_TYPES)
          .gte('created_at', historyLookback.toISOString()),
        supabase
          .from('proactive_coach_messages')
          .select('user_id, trigger_type, created_at')
          .in('user_id', userIds)
          .gte('created_at', historyLookback.toISOString()),
      ])

    if (workoutsResult.error) throw workoutsResult.error
    if (notificationsResult.error) throw notificationsResult.error
    if (proactiveResult.error) throw proactiveResult.error

    const workoutsByUser = new Map<string, WorkoutRow[]>()
    for (const workout of (workoutsResult.data || []) as WorkoutRow[]) {
      const list = workoutsByUser.get(workout.user_id) || []
      list.push(workout)
      workoutsByUser.set(workout.user_id, list)
    }

    const notificationsByUser = new Map<string, NotificationHistoryRow[]>()
    for (const row of (notificationsResult.data || []) as NotificationHistoryRow[]) {
      const list = notificationsByUser.get(row.recipient_id) || []
      list.push(row)
      notificationsByUser.set(row.recipient_id, list)
    }

    const proactiveByUser = new Map<string, ProactiveHistoryRow[]>()
    for (const row of (proactiveResult.data || []) as ProactiveHistoryRow[]) {
      const list = proactiveByUser.get(row.user_id) || []
      list.push(row)
      proactiveByUser.set(row.user_id, list)
    }

    const queued: {
      userId: string
      triggerType: ProactiveTriggerType
      coachId: string
      body: string
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

      const userNotifications = notificationsByUser.get(pref.user_id) || []
      const pushesLast7Days = userNotifications.filter(
        (item) => new Date(item.created_at) >= weeklyLimitLookback,
      ).length
      const effectiveWeeklyPushLimit = getAdaptiveWeeklyPushLimit(
        pref.max_pushes_per_week,
        {
          commitment: pref.profile?.commitment,
          commitmentFrequency: pref.profile?.commitment_frequency,
        },
      )

      if (pushesLast7Days >= effectiveWeeklyPushLimit) {
        skipped.push({ userId: pref.user_id, reason: 'weekly_limit' })
        continue
      }

      const latestProactive = (proactiveByUser.get(pref.user_id) || []).reduce<
        ProactiveHistoryRow | null
      >((latest, item) => {
        if (!latest) return item
        return item.created_at > latest.created_at ? item : latest
      }, null)

      if (
        latestProactive &&
        withinLastHours(latestProactive.created_at, now, MIN_SPACING_HOURS)
      ) {
        skipped.push({ userId: pref.user_id, reason: 'min_spacing' })
        continue
      }

      const todayDateKey = getLocalDateKey(now, timezone)
      const localWeekday = getLocalWeekday(now, timezone)
      const trigger = pickProactiveTrigger({
        pref,
        timezone,
        todayDateKey,
        localHour,
        localWeekday,
        workouts: workoutsByUser.get(pref.user_id) || [],
        proactiveHistory: proactiveByUser.get(pref.user_id) || [],
      })

      if (!trigger) {
        skipped.push({ userId: pref.user_id, reason: 'no_eligible_trigger' })
        continue
      }

      const coach = getCoach(pref.profile?.coach)
      const body = dryRun
        ? `[dry run] ${trigger.type}`
        : (
            await generateText({
              model: openrouter.chat(GEMINI_FLASH_LATEST_MODEL),
              system:
                buildSystemPrompt(
                  await buildUserContextSummary(pref.user_id, supabase),
                  'kg',
                  coach.systemPrompt,
                ) +
                '\n\n' +
                buildProactiveInstruction({
                  trigger,
                  displayName: pref.profile?.display_name ?? '',
                }),
              prompt: 'Write the proactive coach opener now.',
              maxTokens: 180,
              maxRetries: 1,
            })
          ).text.trim()

      queued.push({
        userId: pref.user_id,
        triggerType: trigger.type,
        coachId: coach.id,
        body,
        dryRun,
      })

      if (dryRun) continue

      const { data: proactiveRow, error: proactiveInsertError } = await supabase
        .from('proactive_coach_messages')
        .insert({
          user_id: pref.user_id,
          trigger_type: trigger.type,
          coach_id: coach.id,
          body,
          metadata: {
            ...trigger.metadata,
            generated_at: now.toISOString(),
          },
        })
        .select('id')
        .single()

      if (proactiveInsertError) {
        console.error(
          '[send-proactive-coach-messages] Failed to insert proactive message',
          pref.user_id,
          proactiveInsertError,
        )
        skipped.push({ userId: pref.user_id, reason: 'message_insert_failed' })
        continue
      }

      const { error: notificationInsertError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: pref.user_id,
          type: `proactive_coach_${trigger.type}`,
          actors: [],
          read: false,
          metadata: {
            title: coach.name,
            body: truncatePushBody(body),
            route: '/chat',
            source: 'proactive_coach_scheduler',
            proactiveId: proactiveRow.id,
            ...trigger.metadata,
          },
        })

      if (notificationInsertError) {
        console.error(
          '[send-proactive-coach-messages] Failed to insert notification',
          pref.user_id,
          notificationInsertError,
        )
        skipped.push({ userId: pref.user_id, reason: 'notification_insert_failed' })
      }
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
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[send-proactive-coach-messages] Unexpected error:', error)
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
