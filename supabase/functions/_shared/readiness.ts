import {
  getSelectedCommitmentDays,
  getWeeklyCommitmentTarget,
} from './commitment.ts'
import type { SupabaseClient } from './supabase.ts'

export type RecoveryStatus =
  | 'not_recovered'
  | 'recovering'
  | 'recovered'
  | 'untrained'

export type WorkoutIntensity = 'light' | 'moderate' | 'heavy'

export type AdherenceStatus = 'ahead' | 'on_track' | 'behind' | 'inactive'

interface RecoverySetRow {
  weight: number | null
}

interface RecoveryExerciseRow {
  exercise?: {
    muscle_group?: string | null
    secondary_muscles?: string[] | null
  } | null
  sets?: RecoverySetRow[] | null
}

interface RecoverySessionRow {
  id: string
  created_at: string
  date: string | null
  workout_exercises?: RecoveryExerciseRow[] | null
}

interface DateOnlySessionRow {
  date: string | null
}

export interface MuscleRecoverySnapshot {
  muscleGroup: string
  lastWorkedDate: string | null
  hoursSinceLastWorkout: number | null
  recoveryStatus: RecoveryStatus
  recoveryPercentage: number
  intensity: WorkoutIntensity | null
  recoveryTimeHours: number | null
}

export interface RecoveryOverview {
  daysSinceLastWorkout: number | null
  freshMuscleGroups: number
  totalMuscleGroups: number
}

export interface RecoverySummary extends RecoveryOverview {
  lastWorkoutDate: string | null
  muscleRecovery: MuscleRecoverySnapshot[]
}

export interface WeeklyAdherenceSnapshot {
  weekStart: string
  weekEnd: string
  workoutCount: number
  hitTarget: boolean
}

export interface AdherenceSummary {
  weeklyTarget: number
  commitmentDays: string[]
  currentStreakWeeks: number
  workoutsThisWeek: number
  expectedWorkoutsByNow: number
  currentWeekStart: string
  currentWeekEnd: string
  currentWeekWorkoutDates: string[]
  recentWorkoutDates: string[]
  recentWeeks: WeeklyAdherenceSnapshot[]
  recentAverageWorkoutsPerWeek: number
  weeksHitTarget: number
  evaluatedWeeks: number
  adherenceStatus: AdherenceStatus
  hotStreak: boolean
  lastWorkoutDate: string | null
  daysSinceLastWorkout: number | null
}

const LIGHT_THRESHOLD = 4
const MODERATE_THRESHOLD = 8
const WEIGHTED_MULTIPLIER = 1.5
const SECONDARY_MUSCLE_SET_FACTOR = 0.5
const RECOVERY_LOOKBACK_DAYS = 7

const RECOVERY_TIMES: Record<WorkoutIntensity, number> = {
  light: 36,
  moderate: 54,
  heavy: 72,
}

const TRACKED_RECOVERY_MUSCLE_GROUPS = [
  'Shoulders',
  'Chest',
  'Triceps',
  'Biceps',
  'Back',
  'Lower Back',
  'Forearms',
  'Traps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Adductors',
] as const

const SECONDARY_MUSCLE_MAP: Record<string, string> = {
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  core: 'Core',
  back: 'Back',
  chest: 'Chest',
  quadriceps: 'Quads',
  quads: 'Quads',
  shoulders: 'Shoulders',
  deltoids: 'Shoulders',
  'rear deltoids': 'Shoulders',
  'front deltoids': 'Shoulders',
  trapezius: 'Traps',
  traps: 'Traps',
  'levator scapulae': 'Traps',
  'lower back': 'Lower Back',
  'erector spinae': 'Lower Back',
  lats: 'Back',
  rhomboids: 'Back',
  'upper back': 'Back',
}

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function toDateOnly(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().split('T')[0]
}

function startOfWeek(date: Date): Date {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)
  result.setUTCDate(result.getUTCDate() - result.getUTCDay())
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function diffInDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function diffInHours(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60)
}

function normalizeSecondaryMuscle(muscle: string): string | null {
  return SECONDARY_MUSCLE_MAP[muscle.toLowerCase()] ?? null
}

function calculateIntensity(
  totalSets: number,
  hadWeightedSets: boolean,
): WorkoutIntensity {
  const effectiveSets = hadWeightedSets
    ? totalSets * WEIGHTED_MULTIPLIER
    : totalSets

  if (effectiveSets < LIGHT_THRESHOLD) return 'light'
  if (effectiveSets < MODERATE_THRESHOLD) return 'moderate'
  return 'heavy'
}

function getRecoveryStatusWithIntensity(
  hoursSinceLastWorkout: number | null,
  recoveryTimeHours: number,
): RecoveryStatus {
  if (hoursSinceLastWorkout === null) return 'untrained'

  const notRecoveredThreshold = recoveryTimeHours * 0.33
  if (hoursSinceLastWorkout < notRecoveredThreshold) return 'not_recovered'
  if (hoursSinceLastWorkout < recoveryTimeHours) return 'recovering'
  return 'recovered'
}

function calculateRecoveryPercentage(
  hoursSinceLastWorkout: number | null,
  recoveryTimeHours: number | null,
): number {
  if (hoursSinceLastWorkout === null || recoveryTimeHours === null) {
    return 100
  }

  return Math.round(
    Math.min(100, (hoursSinceLastWorkout / recoveryTimeHours) * 100),
  )
}

function dedupeSortedDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort((left, right) =>
    left > right ? -1 : left < right ? 1 : 0,
  )
}

function calculateCurrentStreakWeeks(uniqueDatesDesc: string[], now: Date): number {
  if (uniqueDatesDesc.length === 0) return 0

  const weeksWithWorkouts = new Set<string>()
  uniqueDatesDesc.forEach((dateString) => {
    weeksWithWorkouts.add(toDateOnly(startOfWeek(new Date(`${dateString}T00:00:00Z`))))
  })

  const currentWeekStart = startOfWeek(now)
  const currentWeekKey = toDateOnly(currentWeekStart)
  const lastWeekKey = toDateOnly(addDays(currentWeekStart, -7))

  const hasCurrentWeekWorkout = weeksWithWorkouts.has(currentWeekKey)
  const hasLastWeekWorkout = weeksWithWorkouts.has(lastWeekKey)

  let streakStartWeek: Date
  if (hasCurrentWeekWorkout) {
    streakStartWeek = currentWeekStart
  } else if (hasLastWeekWorkout) {
    streakStartWeek = addDays(currentWeekStart, -7)
  } else {
    return 0
  }

  const sortedWeeks = Array.from(weeksWithWorkouts).sort((left, right) =>
    left > right ? -1 : left < right ? 1 : 0,
  )

  let currentStreak = 0
  for (let index = 0; index < sortedWeeks.length; index += 1) {
    const expectedWeek = toDateOnly(addDays(streakStartWeek, -7 * index))
    if (sortedWeeks[index] === expectedWeek) {
      currentStreak += 1
    } else {
      break
    }
  }

  return currentStreak
}

function calculateExpectedWorkoutsByNow(input: {
  weeklyTarget: number
  commitmentDays: string[]
  now: Date
}): number {
  const { weeklyTarget, commitmentDays, now } = input
  const currentDay = now.getUTCDay()

  if (commitmentDays.length > 0) {
    const scheduledByNow = commitmentDays.filter((day) => {
      const dayIndex = WEEKDAY_INDEX[day]
      return dayIndex !== undefined && dayIndex <= currentDay
    }).length

    return Math.max(0, scheduledByNow)
  }

  const elapsedDays = currentDay + 1
  return Math.min(
    weeklyTarget,
    Math.max(0, Math.round((elapsedDays / 7) * weeklyTarget)),
  )
}

function resolveAdherenceStatus(input: {
  workoutsThisWeek: number
  expectedWorkoutsByNow: number
  weeklyTarget: number
  lastWorkoutDate: string | null
  daysSinceLastWorkout: number | null
}): AdherenceStatus {
  const {
    workoutsThisWeek,
    expectedWorkoutsByNow,
    weeklyTarget,
    lastWorkoutDate,
    daysSinceLastWorkout,
  } = input

  if (!lastWorkoutDate) return 'inactive'
  if (workoutsThisWeek >= weeklyTarget) return 'ahead'
  if (workoutsThisWeek >= expectedWorkoutsByNow) return 'on_track'
  if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 7) return 'behind'
  return 'behind'
}

export async function buildRecoverySummary(
  supabase: SupabaseClient,
  userId: string,
  options: { daysBack?: number; now?: Date } = {},
): Promise<RecoverySummary> {
  const now = options.now ?? new Date()
  const daysBack = Math.min(
    Math.max(options.daysBack ?? RECOVERY_LOOKBACK_DAYS, 1),
    14,
  )
  const cutoffDate = addDays(now, -daysBack)

  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      `
        id,
        created_at,
        date,
        workout_exercises (
          exercise:exercises (
            muscle_group,
            secondary_muscles
          ),
          sets (
            weight
          )
        )
      `,
    )
    .eq('user_id', userId)
    .gte('date', cutoffDate.toISOString())
    .order('date', { ascending: false })

  if (error) throw error

  const muscleWorkoutHistory = new Map<
    string,
    { date: Date; sets: number; hadWeight: boolean }[]
  >()
  let mostRecentWorkout: Date | null = null

  const sessions = (data as RecoverySessionRow[]) ?? []
  sessions.forEach((session) => {
    const sessionDate = new Date(session.date || session.created_at)

    if (!mostRecentWorkout || sessionDate > mostRecentWorkout) {
      mostRecentWorkout = sessionDate
    }

    const sessionMuscleData = new Map<
      string,
      { sets: number; hadWeight: boolean }
    >()

    session.workout_exercises?.forEach((workoutExercise) => {
      const primaryMuscle = workoutExercise.exercise?.muscle_group
      const secondaryMuscles =
        workoutExercise.exercise?.secondary_muscles ?? []
      const sets = workoutExercise.sets ?? []
      const setCount = sets.length
      const hadWeight = sets.some(
        (set) => typeof set.weight === 'number' && set.weight > 0,
      )

      if (primaryMuscle) {
        const existing = sessionMuscleData.get(primaryMuscle) ?? {
          sets: 0,
          hadWeight: false,
        }

        sessionMuscleData.set(primaryMuscle, {
          sets: existing.sets + setCount,
          hadWeight: existing.hadWeight || hadWeight,
        })
      }

      secondaryMuscles.forEach((rawSecondaryMuscle) => {
        const secondaryMuscle = normalizeSecondaryMuscle(rawSecondaryMuscle)
        if (!secondaryMuscle || secondaryMuscle === primaryMuscle) return

        const existing = sessionMuscleData.get(secondaryMuscle) ?? {
          sets: 0,
          hadWeight: false,
        }

        sessionMuscleData.set(secondaryMuscle, {
          sets:
            existing.sets +
            Math.ceil(setCount * SECONDARY_MUSCLE_SET_FACTOR),
          hadWeight: existing.hadWeight || hadWeight,
        })
      })
    })

    sessionMuscleData.forEach((sessionGroupData, muscleGroup) => {
      const history = muscleWorkoutHistory.get(muscleGroup) ?? []
      history.push({
        date: sessionDate,
        sets: sessionGroupData.sets,
        hadWeight: sessionGroupData.hadWeight,
      })
      muscleWorkoutHistory.set(muscleGroup, history)
    })
  })

  const muscleRecovery = TRACKED_RECOVERY_MUSCLE_GROUPS.map((muscleGroup) => {
    const history = muscleWorkoutHistory.get(muscleGroup)

    if (!history || history.length === 0) {
      return {
        muscleGroup,
        lastWorkedDate: null,
        hoursSinceLastWorkout: null,
        recoveryStatus: 'untrained' as const,
        recoveryPercentage: 100,
        intensity: null,
        recoveryTimeHours: null,
      }
    }

    const sortedHistory = [...history].sort(
      (left, right) => right.date.getTime() - left.date.getTime(),
    )
    const lastSessionDate = sortedHistory[0].date
    const boutThresholdMs = 24 * 60 * 60 * 1000

    let totalSets = 0
    let hadWeightedSets = false

    history.forEach((workout) => {
      const timeDiff = Math.abs(
        lastSessionDate.getTime() - workout.date.getTime(),
      )

      if (timeDiff <= boutThresholdMs) {
        totalSets += workout.sets
        if (workout.hadWeight) {
          hadWeightedSets = true
        }
      }
    })

    const hoursSinceLastWorkout = diffInHours(lastSessionDate, now)
    const intensity = calculateIntensity(totalSets, hadWeightedSets)
    const recoveryTimeHours = RECOVERY_TIMES[intensity]
    const recoveryStatus = getRecoveryStatusWithIntensity(
      hoursSinceLastWorkout,
      recoveryTimeHours,
    )
    const recoveryPercentage = calculateRecoveryPercentage(
      hoursSinceLastWorkout,
      recoveryTimeHours,
    )

    return {
      muscleGroup,
      lastWorkedDate: lastSessionDate.toISOString(),
      hoursSinceLastWorkout,
      recoveryStatus,
      recoveryPercentage,
      intensity,
      recoveryTimeHours,
    }
  }).sort((left, right) => {
    if (left.recoveryPercentage !== right.recoveryPercentage) {
      return left.recoveryPercentage - right.recoveryPercentage
    }

    const leftTime = left.lastWorkedDate
      ? new Date(left.lastWorkedDate).getTime()
      : Number.NEGATIVE_INFINITY
    const rightTime = right.lastWorkedDate
      ? new Date(right.lastWorkedDate).getTime()
      : Number.NEGATIVE_INFINITY

    return rightTime - leftTime
  })

  const recoveringCount = muscleRecovery.filter(
    (entry) =>
      entry.recoveryStatus === 'not_recovered' ||
      entry.recoveryStatus === 'recovering',
  ).length

  return {
    lastWorkoutDate: mostRecentWorkout ? mostRecentWorkout.toISOString() : null,
    daysSinceLastWorkout: mostRecentWorkout
      ? diffInDays(mostRecentWorkout, now)
      : null,
    freshMuscleGroups: muscleRecovery.length - recoveringCount,
    totalMuscleGroups: muscleRecovery.length,
    muscleRecovery,
  }
}

export async function buildAdherenceSummary(
  supabase: SupabaseClient,
  userId: string,
  commitment: unknown,
  commitmentFrequency: unknown = null,
  options: { weeksBack?: number; calendarDays?: number; now?: Date } = {},
): Promise<AdherenceSummary> {
  const now = options.now ?? new Date()
  const weeksBack = Math.min(Math.max(options.weeksBack ?? 6, 2), 16)
  const calendarDays = Math.min(Math.max(options.calendarDays ?? 30, 7), 120)

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw error

  const allSessionDates = ((data as DateOnlySessionRow[]) ?? [])
    .map((session) => session.date)
    .filter((date): date is string => typeof date === 'string' && date.length > 0)
    .map((date) => date.split('T')[0])
    .sort((left, right) => (left > right ? -1 : left < right ? 1 : 0))

  const uniqueDatesDesc = dedupeSortedDates(allSessionDates)
  const lastWorkoutDate = uniqueDatesDesc[0] ?? null
  const lastWorkoutDateObj = lastWorkoutDate
    ? new Date(`${lastWorkoutDate}T00:00:00Z`)
    : null
  const daysSinceLastWorkout = lastWorkoutDateObj
    ? diffInDays(lastWorkoutDateObj, now)
    : null

  const weeklyTarget = getWeeklyCommitmentTarget({
    commitment,
    commitmentFrequency,
  })
  const commitmentDays = getSelectedCommitmentDays(commitment)
  const currentWeekStart = startOfWeek(now)
  const currentWeekEnd = addDays(currentWeekStart, 6)
  const currentWeekStartKey = toDateOnly(currentWeekStart)
  const nextWeekStartKey = toDateOnly(addDays(currentWeekStart, 7))

  const currentWeekWorkoutDates = dedupeSortedDates(
    uniqueDatesDesc.filter(
      (date) => date >= currentWeekStartKey && date < nextWeekStartKey,
    ),
  )

  const workoutsThisWeek = allSessionDates.filter(
    (date) => date >= currentWeekStartKey && date < nextWeekStartKey,
  ).length

  const recentWeeks: WeeklyAdherenceSnapshot[] = []
  for (let index = 0; index < weeksBack; index += 1) {
    const weekStart = addDays(currentWeekStart, -7 * index)
    const weekEnd = addDays(weekStart, 6)
    const weekStartKey = toDateOnly(weekStart)
    const nextWeekKey = toDateOnly(addDays(weekStart, 7))
    const workoutCount = allSessionDates.filter(
      (date) => date >= weekStartKey && date < nextWeekKey,
    ).length

    recentWeeks.push({
      weekStart: weekStartKey,
      weekEnd: toDateOnly(weekEnd),
      workoutCount,
      hitTarget: workoutCount >= weeklyTarget,
    })
  }

  const recentAverageWorkoutsPerWeek =
    recentWeeks.length > 0
      ? Math.round(
          (recentWeeks.reduce((sum, week) => sum + week.workoutCount, 0) /
            recentWeeks.length) *
            10,
        ) / 10
      : 0

  const recentWorkoutCutoff = toDateOnly(addDays(now, -calendarDays))
  const recentWorkoutDates = dedupeSortedDates(
    uniqueDatesDesc.filter((date) => date >= recentWorkoutCutoff),
  )

  const currentStreakWeeks = calculateCurrentStreakWeeks(uniqueDatesDesc, now)
  const weeksHitTarget = recentWeeks.filter((week) => week.hitTarget).length
  const expectedWorkoutsByNow = calculateExpectedWorkoutsByNow({
    weeklyTarget,
    commitmentDays,
    now,
  })
  const adherenceStatus = resolveAdherenceStatus({
    workoutsThisWeek,
    expectedWorkoutsByNow,
    weeklyTarget,
    lastWorkoutDate,
    daysSinceLastWorkout,
  })

  return {
    weeklyTarget,
    commitmentDays,
    currentStreakWeeks,
    workoutsThisWeek,
    expectedWorkoutsByNow,
    currentWeekStart: currentWeekStartKey,
    currentWeekEnd: toDateOnly(currentWeekEnd),
    currentWeekWorkoutDates,
    recentWorkoutDates,
    recentWeeks,
    recentAverageWorkoutsPerWeek,
    weeksHitTarget,
    evaluatedWeeks: recentWeeks.length,
    adherenceStatus,
    hotStreak: currentStreakWeeks >= 3,
    lastWorkoutDate,
    daysSinceLastWorkout,
  }
}
